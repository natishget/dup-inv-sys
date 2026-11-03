import { Test, TestingModule } from '@nestjs/testing';
import { CostingMethodName } from '@prisma/client';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: SettingsService;

  const mockSettingsService = {
    getActiveCostingMethod: jest.fn(),
    updateActiveCostingMethod: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getActiveCostingMethod', () => {
    it('delegates to SettingsService.getActiveCostingMethod', async () => {
      const mockResponse = {
        activeMethod: CostingMethodName.FIFO,
        activeMethodId: 'method-fifo-id',
        availableMethods: [],
      };
      mockSettingsService.getActiveCostingMethod.mockResolvedValue(mockResponse);

      const result = await controller.getActiveCostingMethod();

      expect(result).toEqual(mockResponse);
      expect(service.getActiveCostingMethod).toHaveBeenCalled();
    });
  });

  describe('updateActiveCostingMethod', () => {
    it('delegates to SettingsService.updateActiveCostingMethod with adminUserId', async () => {
      const mockResponse = {
        message: 'Updated',
        previousMethod: CostingMethodName.FIFO,
        activeMethod: CostingMethodName.LIFO,
        updatedAt: new Date().toISOString(),
      };
      mockSettingsService.updateActiveCostingMethod.mockResolvedValue(mockResponse);

      const result = await controller.updateActiveCostingMethod(
        { costingMethod: CostingMethodName.LIFO },
        'admin-user-1',
      );

      expect(result).toEqual(mockResponse);
      expect(service.updateActiveCostingMethod).toHaveBeenCalledWith(
        { costingMethod: CostingMethodName.LIFO },
        'admin-user-1',
      );
    });
  });
});

