import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Product, ProductVariant, ProductOrigin } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { QueryProductVariantDto } from './dto/query-product-variant.dto';
import { ImportProductsDto, ProductImportItem } from './dto/import-products.dto';

export interface PaginatedVariantsResponse {
  data: (ProductVariant & { product: Product | null })[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all master products, ordered alphabetically.
   */
  async findAllProducts(): Promise<Product[]> {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Creates a master product. Enforces unique product names.
   */
  async createProduct(dto: CreateProductDto): Promise<Product> {
    const trimmedName = dto.name.trim();

    const existing = await this.prisma.product.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`Product with name "${trimmedName}" already exists.`);
    }

    return this.prisma.product.create({
      data: {
        name: trimmedName,
        baseUnit: dto.baseUnit?.trim() || null,
      },
    });
  }

  /**
   * Deletes a master product.
   * Safety Rule: Cannot delete a product if child variants exist.
   */
  async deleteProduct(id: string): Promise<{ message: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { variants: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" was not found.`);
    }

    if (product._count.variants > 0) {
      throw new UnprocessableEntityException(
        'Delete the related variants first before removing this product.',
      );
    }

    await this.prisma.product.delete({
      where: { id },
    });

    return { message: 'Product deleted successfully.' };
  }

  /**
   * Retrieves paginated variants with filter criteria (search, origin, color).
   */
  async findAllVariants(
    query: QueryProductVariantDto,
  ): Promise<PaginatedVariantsResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductVariantWhereInput = {};

    if (query.origin) {
      where.origin = query.origin;
    }

    if (query.color && query.color.trim() && query.color !== 'ALL') {
      where.color = { equals: query.color.trim(), mode: 'insensitive' };
    }

    if (query.q && query.q.trim()) {
      const searchTerm = query.q.trim();
      where.OR = [
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { color: { contains: searchTerm, mode: 'insensitive' } },
        {
          product: {
            name: { contains: searchTerm, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.findMany({
        where,
        include: { product: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Returns a list of distinct variant colors for filtering.
   */
  async getDistinctColors(): Promise<string[]> {
    const results = await this.prisma.productVariant.findMany({
      select: { color: true },
      distinct: ['color'],
      where: {
        color: { not: null },
      },
      orderBy: { color: 'asc' },
    });

    return results
      .map((r) => r.color?.trim())
      .filter((c): c is string => Boolean(c && c.length > 0));
  }

  /**
   * Creates a product variant under a parent product.
   */
  async createVariant(
    dto: CreateProductVariantDto,
  ): Promise<ProductVariant & { product: Product | null }> {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Parent product with ID "${dto.productId}" was not found.`,
      );
    }

    if (dto.sku && dto.sku.trim()) {
      const trimmedSku = dto.sku.trim();
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: trimmedSku },
      });
      if (existingSku) {
        throw new ConflictException(`SKU "${trimmedSku}" is already in use.`);
      }
    }

    return this.prisma.productVariant.create({
      data: {
        productId: dto.productId,
        color: dto.color?.trim() || null,
        origin: dto.origin || null,
        sku: dto.sku?.trim() || null,
        thickness:
          dto.thickness !== undefined && dto.thickness !== null
            ? new Prisma.Decimal(dto.thickness)
            : null,
        size: dto.size?.trim() || null,
      },
      include: {
        product: true,
      },
    });
  }

  /**
   * Updates an existing product variant.
   */
  async updateVariant(
    id: string,
    dto: UpdateProductVariantDto,
  ): Promise<ProductVariant & { product: Product | null }> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Product variant with ID "${id}" was not found.`);
    }

    if (dto.productId) {
      const parentExists = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });
      if (!parentExists) {
        throw new NotFoundException(
          `Target product with ID "${dto.productId}" was not found.`,
        );
      }
    }

    if (dto.sku && dto.sku.trim()) {
      const trimmedSku = dto.sku.trim();
      const existingSku = await this.prisma.productVariant.findFirst({
        where: {
          sku: trimmedSku,
          id: { not: id },
        },
      });
      if (existingSku) {
        throw new ConflictException(`SKU "${trimmedSku}" is already in use.`);
      }
    }

    return this.prisma.productVariant.update({
      where: { id },
      data: {
        ...(dto.productId ? { productId: dto.productId } : {}),
        ...(dto.color !== undefined ? { color: dto.color?.trim() || null } : {}),
        ...(dto.origin !== undefined ? { origin: dto.origin || null } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku?.trim() || null } : {}),
        ...(dto.thickness !== undefined
          ? {
              thickness:
                dto.thickness !== null
                  ? new Prisma.Decimal(dto.thickness)
                  : null,
            }
          : {}),
        ...(dto.size !== undefined ? { size: dto.size?.trim() || null } : {}),
      },
      include: {
        product: true,
      },
    });
  }

  /**
   * Deletes a product variant.
   * Safety Barrier: Blocks deletion if referenced in inventory ledger or transaction lines.
   */
  async deleteVariant(id: string): Promise<{ message: string }> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            inventoryTransactions: true,
            purchaseItems: true,
            saleItems: true,
            cogsEntries: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID "${id}" was not found.`);
    }

    const { inventoryTransactions, purchaseItems, saleItems, cogsEntries } =
      variant._count;

    if (
      inventoryTransactions > 0 ||
      purchaseItems > 0 ||
      saleItems > 0 ||
      cogsEntries > 0
    ) {
      throw new UnprocessableEntityException(
        'Cannot delete variant because it has active inventory transactions, purchase/sales orders, or COGS entries.',
      );
    }

    await this.prisma.productVariant.delete({
      where: { id },
    });

    return { message: 'Product variant deleted successfully.' };
  }

  /**
   * Bulk imports products and optional nested variants atomically inside a database transaction.
   * Enforces syntax guards, duplicate name checks, duplicate SKU checks, and limits batches to 250 items.
   */
  async importProducts(dto: ImportProductsDto): Promise<{
    message: string;
    importedProductsCount: number;
    importedVariantsCount: number;
  }> {
    let items: ProductImportItem[] = [];

    if (dto.products_json) {
      try {
        const parsed = JSON.parse(dto.products_json);
        if (!Array.isArray(parsed)) {
          throw new Error('Payload must be a JSON array of products');
        }
        items = parsed;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid JSON format';
        throw new BadRequestException(`Failed to parse products_json: ${msg}`);
      }
    } else if (Array.isArray(dto.products)) {
      items = dto.products;
    } else {
      throw new BadRequestException(
        'Must provide either "products_json" string or "products" array in request body.',
      );
    }

    if (items.length === 0) {
      throw new BadRequestException('Import array cannot be empty.');
    }

    if (items.length > 250) {
      throw new BadRequestException(
        `Import batch exceeds maximum limit of 250 products (received ${items.length}).`,
      );
    }

    // 1. In-payload duplicate check & validation
    const seenNames = new Set<string>();
    const duplicateNames: string[] = [];
    const seenSkus = new Set<string>();
    const duplicateSkus: string[] = [];

    for (const item of items) {
      if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        throw new BadRequestException('Every imported product must have a non-empty "name".');
      }

      const normalizedName = item.name.trim().toLowerCase();
      if (seenNames.has(normalizedName)) {
        duplicateNames.push(item.name.trim());
      } else {
        seenNames.add(normalizedName);
      }

      if (Array.isArray(item.variants)) {
        for (const variant of item.variants) {
          if (variant.sku && typeof variant.sku === 'string' && variant.sku.trim()) {
            const normalizedSku = variant.sku.trim().toLowerCase();
            if (seenSkus.has(normalizedSku)) {
              duplicateSkus.push(variant.sku.trim());
            } else {
              seenSkus.add(normalizedSku);
            }
          }
        }
      }
    }

    if (duplicateNames.length > 0) {
      throw new UnprocessableEntityException(
        `The JSON payload contains duplicate product names within itself: ${Array.from(new Set(duplicateNames)).join(', ')}.`,
      );
    }

    if (duplicateSkus.length > 0) {
      throw new UnprocessableEntityException(
        `The JSON payload contains duplicate SKUs within itself: ${Array.from(new Set(duplicateSkus)).join(', ')}.`,
      );
    }

    // 2. Database duplicate pre-check
    const productNames = items.map((i) => i.name.trim());
    const existingProducts = await this.prisma.product.findMany({
      where: {
        name: { in: productNames, mode: 'insensitive' },
      },
      select: { name: true },
    });

    if (existingProducts.length > 0) {
      const conflictList = existingProducts.map((p) => p.name).join(', ');
      throw new UnprocessableEntityException(
        `The JSON payload contains product names that already exist: ${conflictList}.`,
      );
    }

    const allVariantSkus: string[] = [];
    for (const item of items) {
      if (Array.isArray(item.variants)) {
        for (const v of item.variants) {
          if (v.sku?.trim()) {
            allVariantSkus.push(v.sku.trim());
          }
        }
      }
    }

    if (allVariantSkus.length > 0) {
      const existingVariants = await this.prisma.productVariant.findMany({
        where: {
          sku: { in: allVariantSkus, mode: 'insensitive' },
        },
        select: { sku: true },
      });

      if (existingVariants.length > 0) {
        const conflictSkus = existingVariants.map((v) => v.sku).join(', ');
        throw new UnprocessableEntityException(
          `The JSON payload contains SKUs that already exist in database: ${conflictSkus}.`,
        );
      }
    }

    // 3. Atomic Database Insertion
    return this.prisma.$transaction(async (tx) => {
      let createdProductsCount = 0;
      let createdVariantsCount = 0;

      for (const item of items) {
        const baseUnit =
          item.unit?.trim() ||
          item.base_unit?.trim() ||
          item.baseUnit?.trim() ||
          null;

        const product = await tx.product.create({
          data: {
            name: item.name.trim(),
            baseUnit,
          },
        });
        createdProductsCount++;

        if (Array.isArray(item.variants) && item.variants.length > 0) {
          for (const v of item.variants) {
            let originEnum: ProductOrigin | null = null;
            if (v.origin === 'LOCAL' || v.origin === 'IMPORTED') {
              originEnum = v.origin;
            }

            await tx.productVariant.create({
              data: {
                productId: product.id,
                color: v.color?.trim() || null,
                origin: originEnum,
                sku: v.sku?.trim() || null,
                thickness:
                  v.thickness !== undefined && v.thickness !== null
                    ? new Prisma.Decimal(v.thickness)
                    : null,
                size: v.size?.trim() || null,
              },
            });
            createdVariantsCount++;
          }
        }
      }

      return {
        message: `Successfully imported ${createdProductsCount} product(s) and ${createdVariantsCount} variant(s).`,
        importedProductsCount: createdProductsCount,
        importedVariantsCount: createdVariantsCount,
      };
    });
  }
}
