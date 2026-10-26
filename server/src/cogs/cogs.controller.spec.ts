import { Test, TestingModule } from '@nestjs/testing';
import { CogsController } from './cogs.controller';
import { CogsService } from './cogs.service';
import { CostingMethodName } from '@prisma/client';
import type { Response } from 'express';

describe('CogsController', () => {
  let controller: CogsController;

  const mockReport = {
    active_method: CostingMethodName.FIFO,
    selected_method: CostingMethodName.FIFO,
    is_simulated: false,
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    summary: {
      total_revenue: 9000,
      total_cogs: 500,
      total_gross_profit: 8500,
      profit_margin: 94.44,
    },
    data: [],
    meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
  };

  const mockCogsService = {
    generateReport: jest.fn().mockResolvedValue(mockReport),
    exportCsv: jest.fn().mockResolvedValue({
      filename: 'cogs-FIFO-2026-10-01-2026-10-31.csv',
      csv: 'Product Name,Color,Origin,Quantity Sold,Revenue,COGS,Gross Profit,Profit Margin %\n"T","black","LOCAL",1,9000.00,500.00,8500.00,94.44',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CogsController],
      providers: [
        {
          provide: CogsService,
          useValue: mockCogsService,
        },
      ],
    }).compile();

    controller = module.get<CogsController>(CogsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getReport delegates to cogsService.generateReport', async () => {
    const res = await controller.getReport({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(res).toEqual(mockReport);
    expect(mockCogsService.generateReport).toHaveBeenCalled();
  });

  it('exportCsv sets headers and sends CSV payload', async () => {
    const mockRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response;

    await controller.exportCsv({ startDate: '2026-10-01', endDate: '2026-10-31' }, mockRes);

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=UTF-8');
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="cogs-FIFO'),
    );
    expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Product Name,Color'));
  });
});
