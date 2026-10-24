import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SafeUser } from './interfaces/jwt-payload.interface';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockSafeUser: SafeUser = {
    id: 'user-uuid-1',
    name: 'Admin User',
    phone: '+251911000001',
    email: 'admin@inventory.local',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthService = {
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      if (key === 'auth.jwt.refreshCookieName') return 'refresh_token';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should authenticate user, set HttpOnly cookie, and return access token and user', async () => {
      const mockResponse: any = {
        cookie: jest.fn(),
      };

      mockAuthService.login.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: mockSafeUser,
      });

      const result = await controller.login(
        { email: 'admin@inventory.local', password: 'AdminPassword123!' },
        mockResponse,
      );

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        user: mockSafeUser,
      });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });
  });

  describe('refresh', () => {
    it('should rotate tokens and update cookie when valid cookie is passed', async () => {
      const mockRequest: any = {
        cookies: { refresh_token: 'existing-refresh-token' },
      };
      const mockResponse: any = {
        cookie: jest.fn(),
      };

      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: mockSafeUser,
      });

      const result = await controller.refresh(mockRequest, mockResponse);

      expect(result).toEqual({ accessToken: 'new-access-token' });
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });

    it('should throw UnauthorizedException if cookie is missing', async () => {
      const mockRequest: any = { cookies: {} };
      const mockResponse: any = { cookie: jest.fn() };

      await expect(controller.refresh(mockRequest, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should invalidate token in service and clear cookie', async () => {
      const mockResponse: any = {
        clearCookie: jest.fn(),
      };

      const result = await controller.logout('user-uuid-1', mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-uuid-1');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
      expect(result).toEqual({ message: 'Successfully logged out' });
    });
  });

  describe('getProfile', () => {
    it('should return current user profile', () => {
      const profile = controller.getProfile(mockSafeUser);
      expect(profile).toBe(mockSafeUser);
    });
  });

  describe('updateProfile', () => {
    it('should call authService.updateProfile', async () => {
      mockAuthService.updateProfile.mockResolvedValue(mockSafeUser);

      const result = await controller.updateProfile('user-uuid-1', { name: 'New Name' });
      expect(result).toBe(mockSafeUser);
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('user-uuid-1', {
        name: 'New Name',
      });
    });
  });

  describe('changePassword', () => {
    it('should call authService.changePassword and clear cookie', async () => {
      mockAuthService.changePassword.mockResolvedValue({ message: 'Success' });
      const mockResponse: any = { clearCookie: jest.fn() };

      const result = await controller.changePassword(
        'user-uuid-1',
        { currentPassword: 'Old', newPassword: 'NewPassword123!' },
        mockResponse,
      );

      expect(result).toEqual({ message: 'Success' });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        }),
      );
    });
  });
});
