import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockSafeUser = {
    id: 'user-uuid-1',
    name: 'Test Operator',
    email: 'test@inventory.local',
    phone: '+251911000000',
    role: UserRole.SALES,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should list all users', async () => {
    mockUsersService.findAll.mockResolvedValue({
      data: [mockSafeUser],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    const result = await controller.findAll({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(mockUsersService.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('should provision a user', async () => {
    mockUsersService.create.mockResolvedValue(mockSafeUser);

    const dto = {
      name: 'Test Operator',
      email: 'test@inventory.local',
      phone: '+251911000000',
      role: UserRole.SALES,
    };
    const result = await controller.create(dto);
    expect(result).toEqual(mockSafeUser);
    expect(mockUsersService.create).toHaveBeenCalledWith(dto);
  });

  it('should find user by id', async () => {
    mockUsersService.findById.mockResolvedValue(mockSafeUser);

    const result = await controller.findById(mockSafeUser.id);
    expect(result).toEqual(mockSafeUser);
  });

  it('should update user', async () => {
    mockUsersService.update.mockResolvedValue(mockSafeUser);

    const result = await controller.update(mockSafeUser.id, { name: 'Updated' }, 'admin-id');
    expect(result).toEqual(mockSafeUser);
    expect(mockUsersService.update).toHaveBeenCalledWith(mockSafeUser.id, { name: 'Updated' }, 'admin-id');
  });

  it('should delete user', async () => {
    mockUsersService.delete.mockResolvedValue({ message: 'Deleted' });

    const result = await controller.delete(mockSafeUser.id, 'admin-id');
    expect(result.message).toBe('Deleted');
  });

  it('should reset user password', async () => {
    mockUsersService.resetPassword.mockResolvedValue({ message: 'Reset' });

    const result = await controller.resetPassword(mockSafeUser.id);
    expect(result.message).toBe('Reset');
  });
});
