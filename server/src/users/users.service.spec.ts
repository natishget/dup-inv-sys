import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockAdminUser = {
    id: 'admin-uuid-1',
    name: 'Admin User',
    email: 'admin@inventory.local',
    phone: '+251911000001',
    role: UserRole.ADMIN,
    isActive: true,
    password: 'hashed-password',
    rememberToken: 'hashed-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSalesUser = {
    id: 'sales-uuid-2',
    name: 'Sales Person',
    email: 'sales@inventory.local',
    phone: '+251911000002',
    role: UserRole.SALES,
    isActive: true,
    password: 'hashed-password',
    rememberToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated safe users', async () => {
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue([mockAdminUser, mockSalesUser]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('create', () => {
    it('should provision a new operator with default password when not supplied', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockSalesUser,
        id: 'new-uuid',
      });

      const result = await service.create({
        name: 'New Operator',
        email: 'operator@inventory.local',
        phone: '+251911999999',
        role: UserRole.SALES,
      });

      expect(result.email).toBe(mockSalesUser.email);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: UserRole.SALES,
            isActive: true,
          }),
        }),
      );
    });

    it('should reject duplicate email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockAdminUser);

      await expect(
        service.create({
          name: 'Dupe',
          email: 'admin@inventory.local',
          phone: '+251911000099',
          role: UserRole.AUDITOR,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should block self-deactivation', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      await expect(
        service.update(mockAdminUser.id, { isActive: false }, mockAdminUser.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block self-demotion from admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);

      await expect(
        service.update(mockAdminUser.id, { role: UserRole.SALES }, mockAdminUser.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block demoting the last active administrator', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockAdminUser);
      mockPrismaService.user.count.mockResolvedValue(1);

      await expect(
        service.update(mockAdminUser.id, { role: UserRole.AUDITOR }, 'other-admin-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should enforce Self-Deletion Barrier', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockAdminUser,
        purchases: [],
        sales: [],
        inventoryTransactions: [],
      });

      await expect(
        service.delete(mockAdminUser.id, mockAdminUser.id),
      ).rejects.toThrow('You cannot delete your own account from this page.');
    });

    it('should enforce Last-Admin Barrier', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockAdminUser,
        purchases: [],
        sales: [],
        inventoryTransactions: [],
      });
      mockPrismaService.user.count.mockResolvedValue(1);

      await expect(
        service.delete(mockAdminUser.id, 'another-user-id'),
      ).rejects.toThrow('Operation rejected. The system must retain at least one active administrator.');
    });

    it('should deactivate instead of hard delete when transactions exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockSalesUser,
        purchases: [{ id: 'p-1' }],
        sales: [],
        inventoryTransactions: [],
      });
      mockPrismaService.user.update.mockResolvedValue(mockSalesUser);

      const result = await service.delete(mockSalesUser.id, 'admin-id');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false, rememberToken: null },
        }),
      );
      expect(result.message).toContain('deactivated instead of permanently deleted');
    });
  });

  describe('resetPassword', () => {
    it('should reset user password to default System@Pass', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockSalesUser);
      mockPrismaService.user.update.mockResolvedValue(mockSalesUser);

      const result = await service.resetPassword(mockSalesUser.id);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rememberToken: null,
          }),
        }),
      );
      expect(result.message).toContain('System@Pass');
    });
  });
});
