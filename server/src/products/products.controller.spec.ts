import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductOrigin } from '@prisma/client';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

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

  const mockProductsService = {
    findAllProducts: jest.fn().mockResolvedValue([mockProduct]),
    createProduct: jest.fn().mockResolvedValue(mockProduct),
    deleteProduct: jest.fn().mockResolvedValue({ message: 'Product deleted successfully.' }),
    findAllVariants: jest.fn().mockResolvedValue({
      data: [mockVariant],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    }),
    getDistinctColors: jest.fn().mockResolvedValue(['Bronze', 'Silver']),
    createVariant: jest.fn().mockResolvedValue(mockVariant),
    updateVariant: jest.fn().mockResolvedValue(mockVariant),
    deleteVariant: jest.fn().mockResolvedValue({ message: 'Product variant deleted successfully.' }),
    importProducts: jest.fn().mockResolvedValue({
      message: 'Successfully imported 1 product(s) and 1 variant(s).',
      importedProductsCount: 1,
      importedVariantsCount: 1,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should find all products', async () => {
    const res = await controller.findAllProducts();
    expect(res).toEqual([mockProduct]);
  });

  it('should create product', async () => {
    const res = await controller.createProduct({ name: 'Aluminum Profile Series 20' });
    expect(res).toEqual(mockProduct);
  });

  it('should find all variants', async () => {
    const res = await controller.findAllVariants({});
    expect(res.data).toEqual([mockVariant]);
  });

  it('should get distinct colors', async () => {
    const res = await controller.getDistinctColors();
    expect(res).toEqual(['Bronze', 'Silver']);
  });

  it('should create variant', async () => {
    const res = await controller.createVariant({
      productId: 'prod-uuid-1',
      sku: 'ALU-20-BRZ-IMP',
    });
    expect(res).toEqual(mockVariant);
  });

  it('should delete variant', async () => {
    const res = await controller.deleteVariant('var-uuid-1');
    expect(res.message).toContain('deleted');
  });

  it('should delete product', async () => {
    const res = await controller.deleteProduct('prod-uuid-1');
    expect(res.message).toContain('deleted');
  });
});
