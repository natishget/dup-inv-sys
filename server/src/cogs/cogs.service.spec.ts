import { Test, TestingModule } from '@nestjs/testing';
import { CogsService } from './cogs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CostingMethodName,
  TransactionStatus,
  TransactionType,
  ProductOrigin,
} from '@prisma/client';

describe('CogsService', () => {
  let service: CogsService;

  const mockProduct = {
    id: 'prod-1',
    name: 'T',
    baseUnit: 'KG',
  };

  const mockVariant = {
    id: 'var-1',
    productId: 'prod-1',
    color: 'black',
    origin: ProductOrigin.LOCAL,
    sku: 'SKU-002',
    thickness: 0,
    size: '0',
    product: mockProduct,
  };

  const mockPostedSale = {
    id: 'sale-1',
    customerName: 'Biniyam Anteneh',
    saleDate: new Date('2026-10-26T00:00:00.000Z'),
    status: TransactionStatus.POSTED,
    items: [
      {
        id: 'item-1',
        saleId: 'sale-1',
        variantId: 'var-1',
        quantity: 1,
        sellingPrice: 9000,
        totalPrice: 9000,
        variant: mockVariant,
        cogsEntries: [
          {
            id: 'cogs-1',
            saleItemId: 'item-1',
            variantId: 'var-1',
            quantity: 1,
            unitCost: 500,
            totalCost: 500,
            costingMethod: CostingMethodName.FIFO,
            sourceLayerId: 'layer-1',
          },
        ],
      },
    ],
  };

  const mockPrisma = {
    systemSetting: {
      findFirst: jest.fn(),
    },
    sale: {
      findMany: jest.fn(),
    },
    inventoryTransaction: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CogsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<CogsService>(CogsService);
  });

  describe('Active Costing Report (FIFO)', () => {
    it('accurately calculates Revenue, COGS, Gross Profit and Margin for active method', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        costingMethod: { name: CostingMethodName.FIFO },
      });
      mockPrisma.sale.findMany.mockResolvedValue([mockPostedSale]);

      const report = await service.generateReport({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        costingMethod: CostingMethodName.FIFO,
      });

      expect(report.active_method).toBe(CostingMethodName.FIFO);
      expect(report.selected_method).toBe(CostingMethodName.FIFO);
      expect(report.is_simulated).toBe(false);

      // Verify Summary Card figures
      expect(report.summary.total_revenue).toBe(9000);
      expect(report.summary.total_cogs).toBe(500);
      expect(report.summary.total_gross_profit).toBe(8500);
      expect(report.summary.profit_margin).toBe(94.44); // (8500 / 9000) * 100 = 94.44%

      // Verify Variant line items
      expect(report.data).toHaveLength(1);
      const row = report.data[0];
      expect(row.product_name).toBe('T');
      expect(row.color).toBe('black');
      expect(row.origin).toBe('LOCAL');
      expect(row.quantity_sold).toBe(1);
      expect(row.revenue).toBe(9000);
      expect(row.cogs).toBe(500);
      expect(row.gross_profit).toBe(8500);
      expect(row.profit_margin).toBe(94.44);
    });

    it('filters out VOIDED sales in active report query', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        costingMethod: { name: CostingMethodName.FIFO },
      });
      mockPrisma.sale.findMany.mockResolvedValue([]);

      const report = await service.generateReport({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });

      expect(mockPrisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TransactionStatus.POSTED,
          }),
        }),
      );
      expect(report.summary.total_revenue).toBe(0);
      expect(report.summary.total_cogs).toBe(0);
      expect(report.summary.total_gross_profit).toBe(0);
      expect(report.summary.profit_margin).toBe(0);
    });
  });

  describe('Dynamic Timeline Simulation (FIFO vs LIFO vs Weighted Average)', () => {
    /**
     * Master Scenario from Documentation:
     * Batch 1: Buy 100 units @ $100 ($10,000)
     * Batch 2: Buy 200 units @ $120 ($24,000)
     * Outbound Sale: Sell 150 units @ $180 ($27,000 revenue)
     *
     * Expected COGS:
     * - FIFO: 100 @ 100 + 50 @ 120 = $16,000 COGS (Gross Profit: $11,000, Margin: 40.74%)
     * - LIFO: 150 @ 120 = $18,000 COGS (Gross Profit: $9,000, Margin: 33.33%)
     * - Weighted Average: 300 units @ $113.3333 avg -> 150 * 113.3333 = $17,000 COGS (Gross Profit: $10,000, Margin: 37.04%)
     */
    const masterVariant = {
      id: 'var-master',
      productId: 'prod-master',
      color: 'Bronze',
      origin: ProductOrigin.IMPORTED,
      sku: 'ALU-TUBE-50-BLK',
      thickness: 1.4,
      size: '6.0m',
      product: { id: 'prod-master', name: 'Profile Series 20' },
    };

    const mockTransactions = [
      {
        id: 'tx-1',
        variantId: 'var-master',
        warehouseId: 'wh-1',
        transactionType: TransactionType.PURCHASE,
        quantity: 100,
        unitCost: 100,
        referenceType: 'PURCHASE',
        transactionDate: new Date('2026-05-01T10:00:00Z'),
        createdAt: new Date('2026-05-01T10:00:00Z'),
        variant: masterVariant,
      },
      {
        id: 'tx-2',
        variantId: 'var-master',
        warehouseId: 'wh-1',
        transactionType: TransactionType.PURCHASE,
        quantity: 200,
        unitCost: 120,
        referenceType: 'PURCHASE',
        transactionDate: new Date('2026-05-02T10:00:00Z'),
        createdAt: new Date('2026-05-02T10:00:00Z'),
        variant: masterVariant,
      },
      {
        id: 'tx-3',
        variantId: 'var-master',
        warehouseId: 'wh-1',
        transactionType: TransactionType.SALE,
        quantity: -150,
        unitCost: 100,
        referenceType: 'SALE',
        transactionDate: new Date('2026-05-03T10:00:00Z'),
        createdAt: new Date('2026-05-03T10:00:00Z'),
        variant: masterVariant,
      },
    ];

    const mockPostedMasterSale = {
      id: 'sale-master',
      customerName: 'Industrial Client',
      saleDate: new Date('2026-05-03T10:00:00Z'),
      status: TransactionStatus.POSTED,
      items: [
        {
          id: 'item-master',
          saleId: 'sale-master',
          variantId: 'var-master',
          quantity: 150,
          sellingPrice: 180,
          totalPrice: 27000,
          variant: masterVariant,
          cogsEntries: [],
        },
      ],
    };

    it('simulates LIFO correctly matching documentation ($18,000 COGS)', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        costingMethod: { name: CostingMethodName.FIFO },
      });
      mockPrisma.inventoryTransaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.sale.findMany.mockResolvedValue([mockPostedMasterSale]);

      const report = await service.generateReport({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        costingMethod: CostingMethodName.LIFO,
      });

      expect(report.is_simulated).toBe(true);
      expect(report.selected_method).toBe(CostingMethodName.LIFO);
      expect(report.summary.total_revenue).toBe(27000);
      expect(report.summary.total_cogs).toBe(18000);
      expect(report.summary.total_gross_profit).toBe(9000);
      expect(report.summary.profit_margin).toBe(33.33); // (9000 / 27000) * 100 = 33.33%
    });

    it('simulates WEIGHTED_AVERAGE correctly matching documentation ($17,000 COGS)', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        costingMethod: { name: CostingMethodName.FIFO },
      });
      mockPrisma.inventoryTransaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.sale.findMany.mockResolvedValue([mockPostedMasterSale]);

      const report = await service.generateReport({
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        costingMethod: CostingMethodName.WEIGHTED_AVERAGE,
      });

      expect(report.is_simulated).toBe(true);
      expect(report.selected_method).toBe(CostingMethodName.WEIGHTED_AVERAGE);
      expect(report.summary.total_revenue).toBe(27000);
      expect(report.summary.total_cogs).toBe(17000);
      expect(report.summary.total_gross_profit).toBe(10000);
      expect(report.summary.profit_margin).toBe(37.04); // (10000 / 27000) * 100 = 37.04%
    });
  });

  describe('exportCsv', () => {
    it('produces formatted CSV matching compliance specifications', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        costingMethod: { name: CostingMethodName.FIFO },
      });
      mockPrisma.sale.findMany.mockResolvedValue([mockPostedSale]);

      const res = await service.exportCsv({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        costingMethod: CostingMethodName.FIFO,
      });

      expect(res.filename).toContain('cogs-FIFO-2026-10-01-2026-10-31.csv');
      expect(res.csv).toContain(
        'Product Name,Color,Origin,Quantity Sold,Revenue,COGS,Gross Profit,Profit Margin %',
      );
      expect(res.csv).toContain('"T","black","LOCAL",1,9000.00,500.00,8500.00,94.44');
    });
  });
});
