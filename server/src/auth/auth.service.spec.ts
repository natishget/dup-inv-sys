import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-uuid-1',
    name: 'Admin User',
    email: 'admin@inventory.local',
    phone: '+251911000001',
    role: UserRole.ADMIN,
    isActive: true,
    password: '', // will be set dynamically with argon2 hash
    rememberToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'auth.jwt.accessSecret':
          return 'test-access-secret-1234567890123456';
        case 'auth.jwt.accessExpiration':
          return '15m';
        case 'auth.jwt.refreshSecret':
          return 'test-refresh-secret-1234567890123456';
        case 'auth.jwt.refreshExpiration':
          return '7d';
        default:
          return null;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('Password hashing and verification with Argon2id', () => {
    it('should hash a password using Argon2id and verify correctly', async () => {
      const plain = 'StrongP@ssw0rd!';
      const hash = await service.hashPassword(plain);

      expect(hash).toContain('$argon2id$');
      const isValid = await service.verifyPassword(hash, plain);
      expect(isValid).toBe(true);

      const isInvalid = await service.verifyPassword(hash, 'WrongPassword');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Token hashing with SHA-256', () => {
    it('should produce 64-char hex hash and verify in constant time', () => {
      const token = 'sample-random-refresh-token';
      const hash = service.hashToken(token);

      expect(hash).toHaveLength(64);
      expect(service.verifyToken(hash, token)).toBe(true);
      expect(service.verifyToken(hash, 'wrong-token')).toBe(false);
    });
  });

  describe('login', () => {
    it('should authenticate valid credentials, generate tokens, and save hashed refresh token', async () => {
      const plainPassword = 'AdminPassword123!';
      const hashedPassword = await service.hashPassword(plainPassword);

      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });

      mockJwtService.signAsync
        .mockResolvedValueOnce('mock-access-token')
        .mockResolvedValueOnce('mock-refresh-token');

      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
      });

      const result = await service.login({
        email: 'admin@inventory.local',
        password: plainPassword,
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user.email).toBe(mockUser.email);
      expect((result.user as any).password).toBeUndefined();

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: { rememberToken: service.hashToken('mock-refresh-token') },
        }),
      );
    });

    it('should throw UnauthorizedException if email does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'unknown@inventory.local',
          password: 'SomePassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hashedPassword = await service.hashPassword('CorrectPassword');
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });

      await expect(
        service.login({
          email: 'admin@inventory.local',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user account is deactivated', async () => {
      const plainPassword = 'Password123!';
      const hashedPassword = await service.hashPassword(plainPassword);

      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
        password: hashedPassword,
      });

      await expect(
        service.login({
          email: 'admin@inventory.local',
          password: plainPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should rotate access and refresh tokens when valid token is provided', async () => {
      const currentRefreshToken = 'valid-active-refresh-token';
      const storedHash = service.hashToken(currentRefreshToken);

      mockJwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });

      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        rememberToken: storedHash,
      });

      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.refreshTokens(currentRefreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');

      // Verify rotation updated the rememberToken in the database
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: { rememberToken: service.hashToken('new-refresh-token') },
        }),
      );
    });

    it('should detect refresh token reuse, revoke session, and throw UnauthorizedException', async () => {
      const stolenToken = 'stolen-or-outdated-token';
      const genuineToken = 'current-active-token';
      const storedHash = service.hashToken(genuineToken);

      mockJwtService.verifyAsync.mockResolvedValue({ sub: mockUser.id });

      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        rememberToken: storedHash,
      });

      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await expect(service.refreshTokens(stolenToken)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify the session was revoked by setting rememberToken to null
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { rememberToken: null },
      });
    });
  });

  describe('logout', () => {
    it('should clear rememberToken in database', async () => {
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      await service.logout(mockUser.id);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { rememberToken: null },
      });
    });
  });

  describe('getProfile', () => {
    it('should return safe user if active and found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const profile = await service.getProfile(mockUser.id);
      expect(profile.id).toBe(mockUser.id);
      expect(profile.email).toBe(mockUser.email);
      expect((profile as any).password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update name and phone cleanly', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        name: 'New Name',
        phone: '+251999999999',
      });

      const updated = await service.updateProfile(mockUser.id, {
        name: 'New Name',
        phone: '+251999999999',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.phone).toBe('+251999999999');
    });
  });

  describe('changePassword', () => {
    it('should change password and clear rememberToken', async () => {
      const initialHash = await service.hashPassword('OldPass123!');
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: initialHash,
      });
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.changePassword(mockUser.id, {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPassword999!',
      });

      expect(result.message).toBe('Password successfully updated');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            rememberToken: null,
          }),
        }),
      );
    });

    it('should throw UnauthorizedException if current password does not match', async () => {
      const initialHash = await service.hashPassword('OldPass123!');
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password: initialHash,
      });

      await expect(
        service.changePassword(mockUser.id, {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPassword999!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
