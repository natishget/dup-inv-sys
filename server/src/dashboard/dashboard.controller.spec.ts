import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockFinancialsResponse = {
    fiscal_year: 2026,
    start_date: '2026-07-01',
    end_date: '2027-06-30',
    months: [
      {
        month: '2026-07',
        label: 'Jul 2026',
        revenue: 120000,
        cogs: 80000,
        gross_profit: 40000,
      },
    ],
    totals: {
      revenue: 120000,
      cogs: 80000,
      gross_profit: 40000,
    },
  };

  const mockTopProductsResponse = {
    fiscal_year: 2026,
    start_date: '2026-07-01',
    end_date: '2027-06-30',
    limit: 5,
    data: [
      {
        variant_id: 'var-1',
        product_name: 'Aluminum Profile Series 20',
        color: 'Bronze',
        origin: 'IMPORTED',
        label: 'Aluminum Profile Series 20 - Bronze - Imported',
        total_quantity: 1240,
        revenue: 105400,
      },
    ],
  };

  const mockDashboardService = {
    getFinancials: jest.fn().mockResolvedValue(mockFinancialsResponse),
    getTopProducts: jest.fn().mockResolvedValue(mockTopProductsResponse),
    getMetrics: jest.fn().mockResolvedValue({ fiscalYear: 'FY 2026 / 2027' }),
    clearCache: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getFinancials delegates to dashboardService.getFinancials', async () => {
    const result = await controller.getFinancials({ fiscal_year: 2026 });
    expect(result).toEqual(mockFinancialsResponse);
    expect(mockDashboardService.getFinancials).toHaveBeenCalledWith({ fiscal_year: 2026 });
  });

  it('getTopProducts delegates to dashboardService.getTopProducts', async () => {
    const result = await controller.getTopProducts({ fiscal_year: 2026, limit: 5 });
    expect(result).toEqual(mockTopProductsResponse);
    expect(mockDashboardService.getTopProducts).toHaveBeenCalledWith({
      fiscal_year: 2026,
      limit: 5,
    });
  });

  it('clearCache calls service.clearCache and returns success message', async () => {
    const result = await controller.clearCache();
    expect(mockDashboardService.clearCache).toHaveBeenCalled();
    expect(result).toEqual({ success: true, message: 'Dashboard cache cleared successfully.' });
  });
});

