import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrisma = {
    sale: {
      findMany: jest.fn(),
    },
    saleItem: {
      findMany: jest.fn(),
    },
    purchase: {
      findMany: jest.fn(),
    },
    product: {
      count: jest.fn(),
    },
    productVariant: {
      count: jest.fn(),
    },
    inventoryValuation: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFinancials', () => {
    it('aggregates revenue and COGS across 12 fiscal months and caches result', async () => {
      const mockSales = [
        {
          id: 'sale-1',
          totalAmount: 5000,
          saleDate: new Date('2026-07-15T10:00:00.000Z'),
          status: TransactionStatus.POSTED,
          items: [
            {
              totalPrice: 5000,
              cogsEntries: [{ totalCost: 3000 }],
            },
          ],
        },
        {
          id: 'sale-2',
          totalAmount: 10000,
          saleDate: new Date('2026-08-20T10:00:00.000Z'),
          status: TransactionStatus.POSTED,
          items: [
            {
              totalPrice: 10000,
              cogsEntries: [{ totalCost: 6500 }],
            },
          ],
        },
      ];

      (mockPrisma.sale.findMany as jest.Mock).mockResolvedValue(mockSales);

      const res1 = await service.getFinancials({ fiscal_year: 2026 });

      expect(res1.fiscal_year).toBe(2026);
      expect(res1.start_date).toBe('2026-07-01');
      expect(res1.end_date).toBe('2027-06-30');
      expect(res1.months).toHaveLength(12);

      // July 2026
      expect(res1.months[0].month).toBe('2026-07');
      expect(res1.months[0].revenue).toBe(5000);
      expect(res1.months[0].cogs).toBe(3000);
      expect(res1.months[0].gross_profit).toBe(2000);

      // August 2026
      expect(res1.months[1].month).toBe('2026-08');
      expect(res1.months[1].revenue).toBe(10000);
      expect(res1.months[1].cogs).toBe(6500);
      expect(res1.months[1].gross_profit).toBe(3500);

      // Totals
      expect(res1.totals.revenue).toBe(15000);
      expect(res1.totals.cogs).toBe(9500);
      expect(res1.totals.gross_profit).toBe(5500);

      expect(mockPrisma.sale.findMany).toHaveBeenCalledTimes(1);

      // 5-Minute Cache test: second identical query should NOT hit database
      const res2 = await service.getFinancials({ fiscal_year: 2026 });
      expect(res2).toEqual(res1);
      expect(mockPrisma.sale.findMany).toHaveBeenCalledTimes(1);

      // Invalidate cache
      service.clearCache();
      const res3 = await service.getFinancials({ fiscal_year: 2026 });
      expect(res3).toEqual(res1);
      expect(mockPrisma.sale.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTopProducts', () => {
    it('ranks products by volume descending and caches result', async () => {
      const mockSaleItems = [
        {
          variantId: 'var-1',
          quantity: 100,
          totalPrice: 2000,
          variant: {
            id: 'var-1',
            color: 'Bronze',
            origin: 'IMPORTED',
            product: { name: 'Profile 20' },
          },
        },
        {
          variantId: 'var-2',
          quantity: 350,
          totalPrice: 7000,
          variant: {
            id: 'var-2',
            color: 'Silver',
            origin: 'LOCAL',
            product: { name: 'Tube 40x40' },
          },
        },
        {
          variantId: 'var-1',
          quantity: 50,
          totalPrice: 1000,
          variant: {
            id: 'var-1',
            color: 'Bronze',
            origin: 'IMPORTED',
            product: { name: 'Profile 20' },
          },
        },
      ];

      (mockPrisma.saleItem.findMany as jest.Mock).mockResolvedValue(mockSaleItems);

      const res1 = await service.getTopProducts({ fiscal_year: 2026, limit: 10 });

      expect(res1.fiscal_year).toBe(2026);
      expect(res1.data).toHaveLength(2);

      // Top 1: var-2 with 350 units
      expect(res1.data[0].variant_id).toBe('var-2');
      expect(res1.data[0].product_name).toBe('Tube 40x40');
      expect(res1.data[0].total_quantity).toBe(350);
      expect(res1.data[0].revenue).toBe(7000);
      expect(res1.data[0].label).toBe('Tube 40x40 - Silver - Local');

      // Top 2: var-1 with 150 units
      expect(res1.data[1].variant_id).toBe('var-1');
      expect(res1.data[1].total_quantity).toBe(150);
      expect(res1.data[1].revenue).toBe(3000);
      expect(res1.data[1].label).toBe('Profile 20 - Bronze - Imported');

      expect(mockPrisma.saleItem.findMany).toHaveBeenCalledTimes(1);

      // 5-Minute Cache test: second query should hit cache
      const res2 = await service.getTopProducts({ fiscal_year: 2026, limit: 10 });
      expect(res2).toEqual(res1);
      expect(mockPrisma.saleItem.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMetrics', () => {
    it('respects configurable limit parameter for topVariants', async () => {
      const mockSales = [
        {
          id: 'sale-1',
          totalAmount: 1000,
          saleDate: new Date('2026-08-01T10:00:00.000Z'),
          status: TransactionStatus.POSTED,
          items: [
            {
              variantId: 'var-1',
              quantity: 10,
              totalPrice: 200,
              variant: { id: 'var-1', product: { name: 'Item 1' } },
              cogsEntries: [{ totalCost: 100 }],
            },
            {
              variantId: 'var-2',
              quantity: 20,
              totalPrice: 400,
              variant: { id: 'var-2', product: { name: 'Item 2' } },
              cogsEntries: [{ totalCost: 200 }],
            },
            {
              variantId: 'var-3',
              quantity: 30,
              totalPrice: 600,
              variant: { id: 'var-3', product: { name: 'Item 3' } },
              cogsEntries: [{ totalCost: 300 }],
            },
          ],
        },
      ];

      (mockPrisma.sale.findMany as jest.Mock).mockResolvedValue(mockSales);
      (mockPrisma.purchase.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.product.count as jest.Mock).mockResolvedValue(3);
      (mockPrisma.productVariant.count as jest.Mock).mockResolvedValue(3);
      (mockPrisma.inventoryValuation.findMany as jest.Mock).mockResolvedValue([]);

      // Test limit = 2
      const res = await service.getMetrics({ fiscalYear: 'FY 2026 / 2027', limit: 2 });
      expect(res.topVariants).toHaveLength(2);
      expect(res.topVariants[0].variantId).toBe('var-3');
      expect(res.topVariants[1].variantId).toBe('var-2');
    });
  });
});

