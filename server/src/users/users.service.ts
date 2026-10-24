import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { SafeUser } from '../auth/interfaces/jwt-payload.interface';

export interface PaginatedUsersResponse {
  data: SafeUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hashes a plaintext password using Argon2id with standard parameters.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Sanitizes a Prisma User entity into SafeUser (excluding sensitive credentials).
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

  /**
   * Lists users with search query, role filtering, and pagination.
   */
  async findAll(query: QueryUserDto): Promise<PaginatedUsersResponse> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.q && query.q.trim()) {
      const searchTerm = query.q.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Finds a single user by ID.
   */
  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" was not found`);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Provisions a new user operator with default temporary password (System@Pass) or provided password.
   */
  async create(dto: CreateUserDto): Promise<SafeUser> {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();

    // Check email uniqueness
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('Email is already registered by another user');
    }

    // Check phone uniqueness
    const existingPhone = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      throw new ConflictException('Phone number is already registered by another user');
    }

    // Default credential provisioning: System@Pass
    const plainPassword = dto.password || 'System@Pass';
    const hashedPassword = await this.hashPassword(plainPassword);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        phone,
        role: dto.role,
        password: hashedPassword,
        isActive: true,
      },
    });

    return this.sanitizeUser(user);
  }

  /**
   * Updates an existing user with Self-Demotion Barrier and Last-Admin Barrier protections.
   */
  async update(
    id: string,
    dto: UpdateUserDto,
    currentUserId: string,
  ): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" was not found`);
    }

    // Safety Barrier: Self-Deactivation or Self-Demotion
    if (id === currentUserId) {
      if (dto.isActive === false) {
        throw new BadRequestException('You cannot deactivate your own account.');
      }
      if (dto.role && dto.role !== UserRole.ADMIN) {
        throw new BadRequestException('You cannot demote your own account from administrator.');
      }
    }

    // Safety Barrier: Last-Admin Barrier
    const isDemotingOrDeactivatingAdmin =
      user.role === UserRole.ADMIN &&
      (dto.isActive === false || (dto.role && dto.role !== UserRole.ADMIN));

    if (isDemotingOrDeactivatingAdmin) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          'Operation rejected. The system must retain at least one active administrator.',
        );
      }
    }

    // Check uniqueness if email is changed
    if (dto.email && dto.email.trim().toLowerCase() !== user.email) {
      const newEmail = dto.email.trim().toLowerCase();
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: newEmail },
      });
      if (existingEmail) {
        throw new ConflictException('Email is already registered by another user');
      }
    }

    // Check uniqueness if phone is changed
    if (dto.phone && dto.phone.trim() !== user.phone) {
      const newPhone = dto.phone.trim();
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: newPhone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number is already registered by another user');
      }
    }

    // If deactivating or changing role, invalidate user's active session
    const shouldRevokeSession =
      dto.isActive === false || (dto.role && dto.role !== user.role);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.phone ? { phone: dto.phone.trim() } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(shouldRevokeSession ? { rememberToken: null } : {}),
      },
    });

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Deactivates or removes a user with Self-Deletion Barrier and Last-Admin Barrier.
   */
  async delete(
    id: string,
    currentUserId: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        purchases: { take: 1 },
        sales: { take: 1 },
        inventoryTransactions: { take: 1 },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" was not found`);
    }

    // 1. Critical Safety Protection: Self-Deletion Barrier
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account from this page.');
    }

    // 2. Critical Safety Protection: Last-Admin Barrier
    if (user.role === UserRole.ADMIN) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          'Operation rejected. The system must retain at least one active administrator.',
        );
      }
    }

    // Non-destructive check: if user has historical business records, deactivate instead of hard delete
    const hasHistory =
      user.purchases.length > 0 ||
      user.sales.length > 0 ||
      user.inventoryTransactions.length > 0;

    if (hasHistory) {
      await this.prisma.user.update({
        where: { id },
        data: {
          isActive: false,
          rememberToken: null,
        },
      });
      return {
        message: 'User has recorded transactions and was deactivated instead of permanently deleted.',
      };
    }

    // Otherwise, safely delete record
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: 'User account successfully deleted.',
    };
  }

  /**
   * Resets an operator's password to default temporary password (System@Pass).
   */
  async resetPassword(id: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" was not found`);
    }

    const defaultPassword = 'System@Pass';
    const hashedPassword = await this.hashPassword(defaultPassword);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        rememberToken: null,
      },
    });

    return {
      message: 'User password successfully reset to default temporary password: System@Pass',
    };
  }
}
