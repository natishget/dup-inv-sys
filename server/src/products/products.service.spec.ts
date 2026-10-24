import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProductOrigin } from '@prisma/client';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;

  const mockProduct = {
    id: 'prod-uuid-1',
    name: 'Aluminum Profile Series 20',
    baseUnit: 'METER',
    createdAt: new Date(),
  };

  const mockVariant = {
    id: 'var-uuid-1',
    productId: 'prod-uuid-1',
    color: 'Bronze',
    origin: ProductOrigin.IMPORTED,
    sku: 'ALU-20-BRZ-IMP',
    thickness: '1.40',
    size: '6.0m',
    createdAt: new Date(),
    product: mockProduct,
  };

  const mockPrismaService = {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    productVariant: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('findAllProducts', () => {
    it('should return a list of master products', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.findAllProducts();
      expect(result).toEqual([mockProduct]);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('createProduct', () => {
    it('should create a master product when name is unique', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.createProduct({
        name: 'Aluminum Profile Series 20',
        baseUnit: 'METER',
      });

      expect(result).toEqual(mockProduct);
    });

    it('should throw ConflictException if product name already exists', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      await expect(
        service.createProduct({
          name: 'Aluminum Profile Series 20',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteProduct', () => {
    it('should delete product if no child variants exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        _count: { variants: 0 },
      });
      mockPrismaService.product.delete.mockResolvedValue(mockProduct);

      const result = await service.deleteProduct('prod-uuid-1');
      expect(result.message).toContain('deleted successfully');
    });

    it('should throw UnprocessableEntityException if variants exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        ...mockProduct,
        _count: { variants: 2 },
      });

      await expect(service.deleteProduct('prod-uuid-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('findAllVariants', () => {
    it('should return paginated variants', async () => {
      mockPrismaService.productVariant.count.mockResolvedValue(1);
      mockPrismaService.productVariant.findMany.mockResolvedValue([mockVariant]);

      const result = await service.findAllVariants({ page: 1, limit: 10 });
      expect(result.data).toEqual([mockVariant]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('createVariant', () => {
    it('should create a variant under an existing product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.productVariant.findUnique.mockResolvedValue(null);
      mockPrismaService.productVariant.create.mockResolvedValue(mockVariant);

      const result = await service.createVariant({
        productId: 'prod-uuid-1',
        sku: 'ALU-20-BRZ-IMP',
        color: 'Bronze',
        origin: ProductOrigin.IMPORTED,
        thickness: 1.4,
        size: '6.0m',
      });

      expect(result).toEqual(mockVariant);
    });

    it('should throw NotFoundException if parent product does not exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.createVariant({
          productId: 'non-existent',
          sku: 'SKU-001',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if SKU already exists', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.productVariant.findUnique.mockResolvedValue(mockVariant);

      await expect(
        service.createVariant({
          productId: 'prod-uuid-1',
          sku: 'ALU-20-BRZ-IMP',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteVariant', () => {
    it('should delete variant if no transactions exist', async () => {
      mockPrismaService.productVariant.findUnique.mockResolvedValue({
        ...mockVariant,
        _count: {
          inventoryTransactions: 0,
          purchaseItems: 0,
          saleItems: 0,
          cogsEntries: 0,
        },
      });
      mockPrismaService.productVariant.delete.mockResolvedValue(mockVariant);

      const result = await service.deleteVariant('var-uuid-1');
      expect(result.message).toContain('deleted successfully');
    });

    it('should throw UnprocessableEntityException if transactions exist', async () => {
      mockPrismaService.productVariant.findUnique.mockResolvedValue({
        ...mockVariant,
        _count: {
          inventoryTransactions: 5,
          purchaseItems: 2,
          saleItems: 1,
          cogsEntries: 1,
        },
      });

      await expect(service.deleteVariant('var-uuid-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
