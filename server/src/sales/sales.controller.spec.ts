import { Test, TestingModule } from '@nestjs/testing';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { TransactionStatus } from '@prisma/client';

describe('SalesController', () => {
  let controller: SalesController;

  const mockSale = {
    id: 'sale-uuid-1',
    customerName: 'Adebe Kebede',
    totalAmount: '10536.00',
    saleDate: new Date('2026-10-26'),
    status: TransactionStatus.POSTED,
    notes: 'Test note',
    items: [],
  };

  const mockSalesService = {
    findAll: jest.fn().mockResolvedValue({
      data: [mockSale],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    }),
    findOne: jest.fn().mockResolvedValue(mockSale),
    createSale: jest.fn().mockResolvedValue(mockSale),
    updateMetadata: jest.fn().mockResolvedValue(mockSale),
    voidSale: jest.fn().mockResolvedValue({ message: 'Sale voided successfully.', data: mockSale }),
    returnSale: jest.fn().mockResolvedValue({ message: 'Return processed.', data: mockSale }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        {
          provide: SalesService,
          useValue: mockSalesService,
        },
      ],
    }).compile();

    controller = module.get<SalesController>(SalesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll delegates to salesService.findAll', async () => {
    const res = await controller.findAll({});
    expect(res.data).toHaveLength(1);
    expect(mockSalesService.findAll).toHaveBeenCalled();
  });

  it('create delegates to salesService.createSale', async () => {
    const dto = {
      customerName: 'Adebe Kebede',
      warehouseId: 'wh-uuid-1',
      items: [{ variantId: 'var-1', quantity: 2, sellingPrice: 5000 }],
    };
    const res = await controller.create(dto, 'user-1');
    expect(res.customerName).toBe('Adebe Kebede');
    expect(mockSalesService.createSale).toHaveBeenCalledWith(dto, 'user-1');
  });

  it('void delegates to salesService.voidSale', async () => {
    const res = await controller.void('sale-uuid-1', { reason: 'Cancelled' }, 'user-1');
    expect(res.message).toContain('voided');
    expect(mockSalesService.voidSale).toHaveBeenCalledWith('sale-uuid-1', { reason: 'Cancelled' }, 'user-1');
  });
});
