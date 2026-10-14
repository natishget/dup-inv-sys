import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import {
  JwtPayload,
  JwtRefreshPayload,
  SafeUser,
} from './interfaces/jwt-payload.interface';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hashes a plaintext password using Argon2id with recommended security parameters.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies a candidate plaintext password against an Argon2 hash.
   */
  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Computes a SHA-256 hash of a high-entropy token for safe database persistence.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Timing-safe verification of a candidate token hash against a stored hash.
   */
  verifyToken(storedHash: string, candidateToken: string): boolean {
    const candidateHash = this.hashToken(candidateToken);
    try {
      const storedBuffer = Buffer.from(storedHash, 'hex');
      const candidateBuffer = Buffer.from(candidateHash, 'hex');
      if (storedBuffer.length !== candidateBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(storedBuffer, candidateBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Generates both Access Token and Refresh Token for an authenticated user.
   */
  async generateTokens(user: SafeUser): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessSecret = this.configService.get<string>('auth.jwt.accessSecret')!;
    const accessExpiration = (this.configService.get<string>('auth.jwt.accessExpiration') || '15m') as any;
    const refreshSecret = this.configService.get<string>('auth.jwt.refreshSecret')!;
    const refreshExpiration = (this.configService.get<string>('auth.jwt.refreshExpiration') || '7d') as any;

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiration,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiration,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Authenticates user credentials, sets up single-session refresh token, and returns payload.
   */
  async login(loginDto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SafeUser;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      // Intentionally uniform error message to prevent user enumeration
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.verifyPassword(user.password, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account has been deactivated');
    }

    const safeUser = this.sanitizeUser(user);
    const tokens = await this.generateTokens(safeUser);

    // Save hashed refresh token in rememberToken column for single-session rotation/revocation
    const hashedRefreshToken = this.hashToken(tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { rememberToken: hashedRefreshToken },
    });

    return {
      ...tokens,
      user: safeUser,
    };
  }

  /**
   * Rotates access and refresh tokens with single-use refresh token verification.
   */
  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SafeUser;
  }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const refreshSecret = this.configService.get<string>('auth.jwt.refreshSecret')!;
    let payload: JwtRefreshPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account has been deactivated');
    }

    if (!user.rememberToken) {
      throw new UnauthorizedException('Session has expired or was revoked. Please log in again.');
    }

    const isValid = this.verifyToken(user.rememberToken, refreshToken);
    if (!isValid) {
      // Possible token reuse attack detected: invalidate stored token to secure account
      await this.prisma.user.update({
        where: { id: user.id },
        data: { rememberToken: null },
      });
      throw new UnauthorizedException('Refresh token reuse detected. Session terminated.');
    }

    const safeUser = this.sanitizeUser(user);
    const newTokens = await this.generateTokens(safeUser);

    // Rotate refresh token
    const newHashedRefreshToken = this.hashToken(newTokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { rememberToken: newHashedRefreshToken },
    });

    return {
      ...newTokens,
      user: safeUser,
    };
  }

  /**
   * Logs out the user by clearing the stored hashed refresh token.
   */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { rememberToken: null },
    });
  }

  /**
   * Fetches the safe user profile by ID.
   */
  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account has been deactivated');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Sanitizes a Prisma User entity to a SafeUser object.
   */
  sanitizeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
