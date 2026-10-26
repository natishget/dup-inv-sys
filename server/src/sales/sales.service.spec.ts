import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { TransactionStatus, TransactionType, CostingMethodName, Prisma } from '@prisma/client';

describe('SalesService', () => {
  let service: SalesService;

  const mockWarehouse = {
    id: 'wh-uuid-1',
    name: 'Main',
    location: 'Addis Ababa',
  };

  const mockVariant = {
    id: 'var-uuid-1',
    productId: 'prod-uuid-1',
    sku: 'SKU-001',
    color: 'Blue',
    origin: 'IMPORTED',
    thickness: new Prisma.Decimal(3),
    size: '244 x 122',
    product: {
      id: 'prod-uuid-1',
      name: 'Aluminum Panel',
      baseUnit: 'Piece',
    },
  };

  const mockCostLayer = {
    id: 'layer-uuid-1',
    variantId: 'var-uuid-1',
    warehouseId: 'wh-uuid-1',
    remainingQty: new Prisma.Decimal(50),
    unitCost: new Prisma.Decimal(5000),
    createdAt: new Date(),
  };

  const mockSaleItem = {
    id: 'item-uuid-1',
    saleId: 'sale-uuid-1',
    variantId: 'var-uuid-1',
    quantity: new Prisma.Decimal(2),
    sellingPrice: new Prisma.Decimal(5268),
    totalPrice: new Prisma.Decimal(10536),
    variant: mockVariant,
    cogsEntries: [
      {
        id: 'cogs-uuid-1',
        saleItemId: 'item-uuid-1',
        variantId: 'var-uuid-1',
        quantity: new Prisma.Decimal(2),
        unitCost: new Prisma.Decimal(5000),
        totalCost: new Prisma.Decimal(10000),
        costingMethod: CostingMethodName.FIFO,
        sourceLayerId: 'layer-uuid-1',
      },
    ],
  };

  const mockSale = {
    id: 'sale-uuid-1',
    customerName: 'Adebe Kebede',
    totalAmount: new Prisma.Decimal(10536),
    saleDate: new Date('2026-10-26'),
    status: TransactionStatus.POSTED,
    referenceType: 'SALE',
    referenceId: null,
    notes: 'This is a Test Note',
    createdById: 'user-uuid-1',
    createdAt: new Date(),
    createdBy: {
      id: 'user-uuid-1',
      name: 'Sales Manager',
      email: 'sales@inventory.local',
    },
    items: [mockSaleItem],
  };

  const mockPrisma = {
    warehouse: {
      findUnique: jest.fn(),
    },
    productVariant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    systemSetting: {
      findFirst: jest.fn(),
    },
    inventoryCostLayer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    inventoryValuation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    inventoryTransaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    sale: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    saleItem: {
      create: jest.fn(),
    },
    cogsEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb) => cb(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  describe('createSale', () => {
    it('successfully creates a sale with FIFO layer consumption', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.productVariant.findMany.mockResolvedValue([mockVariant]);
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        costingMethod: { name: CostingMethodName.FIFO },
      });
      mockPrisma.inventoryCostLayer.findMany.mockResolvedValue([mockCostLayer]);
      mockPrisma.sale.create.mockResolvedValue(mockSale);
      mockPrisma.saleItem.create.mockResolvedValue(mockSaleItem);
      mockPrisma.inventoryCostLayer.update.mockResolvedValue({});
      mockPrisma.cogsEntry.create.mockResolvedValue({});
      mockPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockPrisma.inventoryValuation.findUnique.mockResolvedValue(null);
      mockPrisma.sale.update.mockResolvedValue(mockSale);
      mockPrisma.sale.findUnique.mockResolvedValue(mockSale);

      const result = await service.createSale(
        {
          customerName: 'Adebe Kebede',
          warehouseId: 'wh-uuid-1',
          saleDate: '2026-10-26',
          notes: 'This is a Test Note',
          items: [
            {
              variantId: 'var-uuid-1',
              quantity: 2,
              sellingPrice: 5268,
            },
          ],
        },
        'user-uuid-1',
      );

      expect(result).toBeDefined();
      expect(result.customerName).toBe('Adebe Kebede');
      expect(mockPrisma.sale.create).toHaveBeenCalled();
      expect(mockPrisma.saleItem.create).toHaveBeenCalled();
      expect(mockPrisma.inventoryCostLayer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'layer-uuid-1' },
          data: { remainingQty: { decrement: new Prisma.Decimal(2) } },
        }),
      );
      expect(mockPrisma.cogsEntry.create).toHaveBeenCalled();
      expect(mockPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionType: TransactionType.SALE,
            quantity: new Prisma.Decimal(-2),
          }),
        }),
      );
    });

    it('throws UnprocessableEntityException when available stock is insufficient', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.productVariant.findMany.mockResolvedValue([mockVariant]);
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        costingMethod: { name: CostingMethodName.FIFO },
      });
      // Layer only has 1 unit available
      mockPrisma.inventoryCostLayer.findMany.mockResolvedValue([
        { ...mockCostLayer, remainingQty: new Prisma.Decimal(1) },
      ]);

      await expect(
        service.createSale(
          {
            customerName: 'Adebe Kebede',
            warehouseId: 'wh-uuid-1',
            items: [
              {
                variantId: 'var-uuid-1',
                quantity: 5,
                sellingPrice: 5268,
              },
            ],
          },
          'user-uuid-1',
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws NotFoundException when warehouse does not exist', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        service.createSale(
          {
            customerName: 'Adebe Kebede',
            warehouseId: 'wh-missing',
            items: [{ variantId: 'var-uuid-1', quantity: 1, sellingPrice: 100 }],
          },
          'user-uuid-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('voidSale', () => {
    it('successfully voids a sale and restores inventory and layers', async () => {
      mockPrisma.sale.findUnique
        .mockResolvedValueOnce(mockSale) // for voidSale check
        .mockResolvedValueOnce({ ...mockSale, status: TransactionStatus.VOIDED }); // for findOne after void
      mockPrisma.inventoryTransaction.findFirst.mockResolvedValue({
        warehouseId: 'wh-uuid-1',
      });
      mockPrisma.sale.update.mockResolvedValue({});
      mockPrisma.inventoryTransaction.create.mockResolvedValue({});
      mockPrisma.inventoryCostLayer.findUnique.mockResolvedValue(mockCostLayer);
      mockPrisma.inventoryCostLayer.update.mockResolvedValue({});
      mockPrisma.inventoryValuation.findUnique.mockResolvedValue(null);

      const res = await service.voidSale(
        'sale-uuid-1',
        { reason: 'Customer cancelled order before delivery' },
        'user-uuid-1',
      );

      expect(res.message).toContain('Sale voided successfully');
      expect(mockPrisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TransactionStatus.VOIDED,
          }),
        }),
      );
      // Compensating positive movement
      expect(mockPrisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionType: TransactionType.SALE_RETURN,
            quantity: new Prisma.Decimal(2),
          }),
        }),
      );
    });

    it('throws BadRequestException if sale is already voided', async () => {
      mockPrisma.sale.findUnique.mockResolvedValue({
        ...mockSale,
        status: TransactionStatus.VOIDED,
      });

      await expect(
        service.voidSale('sale-uuid-1', { reason: 'Duplicate' }, 'user-uuid-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateMetadata', () => {
    it('safely updates customerName and notes', async () => {
      mockPrisma.sale.findUnique
        .mockResolvedValueOnce(mockSale)
        .mockResolvedValueOnce({
          ...mockSale,
          customerName: 'Updated Customer Name',
          notes: 'Updated notes',
        });
      mockPrisma.sale.update.mockResolvedValue({});

      const res = await service.updateMetadata('sale-uuid-1', {
        customerName: 'Updated Customer Name',
        notes: 'Updated notes',
      });

      expect(mockPrisma.sale.update).toHaveBeenCalledWith({
        where: { id: 'sale-uuid-1' },
        data: {
          customerName: 'Updated Customer Name',
          notes: 'Updated notes',
        },
      });
      expect(res.customerName).toBe('Updated Customer Name');
    });
  });

  describe('returnSale', () => {
    it('rejects return quantity exceeding original sold quantity', async () => {
      mockPrisma.sale.findUnique.mockResolvedValue(mockSale);
      mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
      mockPrisma.inventoryTransaction.findMany.mockResolvedValue([]);

      await expect(
        service.returnSale(
          'sale-uuid-1',
          {
            warehouseId: 'wh-uuid-1',
            items: [{ variantId: 'var-uuid-1', quantity: 10 }], // sold was only 2
          },
          'user-uuid-1',
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
