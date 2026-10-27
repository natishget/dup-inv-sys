import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import * as express from 'express';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthResponseDto, RefreshResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SafeUser } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;
  private readonly refreshCookieName: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.refreshCookieName =
      this.configService.get<string>('auth.jwt.refreshCookieName') || 'refresh_token';
  }

  private getCookieOptions(): express.CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken, user } = await this.authService.login(loginDto);

    res.cookie(this.refreshCookieName, refreshToken, this.getCookieOptions());

    return {
      accessToken,
      user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<RefreshResponseDto> {
    const refreshToken = req.cookies?.[this.refreshCookieName];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshTokens(refreshToken);

    res.cookie(this.refreshCookieName, newRefreshToken, this.getCookieOptions());

    return {
      accessToken,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() reqOrUserId: any,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<{ message: string }> {
    let userId: string | null = typeof reqOrUserId === 'string' ? reqOrUserId : null;

    if (!userId && reqOrUserId && typeof reqOrUserId === 'object') {
      if (reqOrUserId.user?.id) {
        userId = reqOrUserId.user.id;
      }

      if (!userId) {
        const refreshToken = reqOrUserId.cookies?.[this.refreshCookieName];
        if (typeof refreshToken === 'string' && refreshToken.includes('.')) {
          try {
            const parts = refreshToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              if (payload?.sub) {
                userId = payload.sub;
              }
            }
          } catch {
            // Ignore malformed token
          }
        }
      }

      if (!userId) {
        const authHeader = reqOrUserId.headers?.authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7).trim();
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              if (payload?.sub) {
                userId = payload.sub;
              }
            }
          } catch {
            // Ignore malformed token
          }
        }
      }
    }

    if (userId) {
      try {
        await this.authService.logout(userId);
      } catch {
        // Ignore DB update error during logout
      }
    }

    res.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      path: '/',
    });

    return {
      message: 'Successfully logged out',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: SafeUser): SafeUser {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<SafeUser> {
    return this.authService.updateProfile(userId, updateProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @Res({ passthrough: true }) res: express.Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.changePassword(userId, changePasswordDto);

    // Invalidate refresh cookie on password change to force fresh authentication
    res.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'strict' : 'lax',
      path: '/',
    });

    return result;
  }
}
