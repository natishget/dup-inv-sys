import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CostingMethodName } from '@prisma/client';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;

  const mockPrisma = {
    systemSetting: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    costingMethod: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(async (cb: (tx: any) => Promise<any>) =>
      cb(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveCostingMethod', () => {
    it('returns active costing method and available methods list', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        id: 'setting-uuid-1',
        activeCostingMethodId: 'method-fifo-id',
        costingMethod: {
          id: 'method-fifo-id',
          name: CostingMethodName.FIFO,
        },
      });

      const result = await service.getActiveCostingMethod();

      expect(result).toBeDefined();
      expect(result.activeMethod).toBe(CostingMethodName.FIFO);
      expect(result.activeMethodId).toBe('method-fifo-id');
      expect(result.availableMethods).toHaveLength(3);
      expect(result.availableMethods.map((m) => m.name)).toEqual(
        expect.arrayContaining([
          CostingMethodName.FIFO,
          CostingMethodName.LIFO,
          CostingMethodName.WEIGHTED_AVERAGE,
        ]),
      );
    });

    it('creates default setting linking to FIFO if setting does not exist', async () => {
      mockPrisma.systemSetting.findFirst.mockResolvedValue(null);
      mockPrisma.costingMethod.findUnique.mockResolvedValue({
        id: 'method-fifo-id',
        name: CostingMethodName.FIFO,
      });
      mockPrisma.systemSetting.create.mockResolvedValue({
        id: 'new-setting-id',
        activeCostingMethodId: 'method-fifo-id',
        costingMethod: {
          id: 'method-fifo-id',
          name: CostingMethodName.FIFO,
        },
      });

      const result = await service.getActiveCostingMethod();

      expect(result.activeMethod).toBe(CostingMethodName.FIFO);
      expect(mockPrisma.systemSetting.create).toHaveBeenCalled();
    });
  });

  describe('updateActiveCostingMethod', () => {
    it('updates active costing method to WEIGHTED_AVERAGE', async () => {
      mockPrisma.costingMethod.findUnique.mockResolvedValue({
        id: 'method-avco-id',
        name: CostingMethodName.WEIGHTED_AVERAGE,
      });
      mockPrisma.systemSetting.findFirst.mockResolvedValue({
        id: 'setting-uuid-1',
        activeCostingMethodId: 'method-fifo-id',
        costingMethod: {
          id: 'method-fifo-id',
          name: CostingMethodName.FIFO,
        },
      });
      mockPrisma.systemSetting.update.mockResolvedValue({});

      const result = await service.updateActiveCostingMethod(
        { costingMethod: CostingMethodName.WEIGHTED_AVERAGE },
        'admin-uuid-1',
      );

      expect(result).toBeDefined();
      expect(result.previousMethod).toBe(CostingMethodName.FIFO);
      expect(result.activeMethod).toBe(CostingMethodName.WEIGHTED_AVERAGE);
      expect(mockPrisma.systemSetting.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'setting-uuid-1' },
          data: { activeCostingMethodId: 'method-avco-id' },
        }),
      );
    });

    it('throws NotFoundException if target costing method is not found in database', async () => {
      mockPrisma.costingMethod.findUnique.mockResolvedValue(null);

      await expect(
        service.updateActiveCostingMethod(
          { costingMethod: CostingMethodName.LIFO },
          'admin-uuid-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

