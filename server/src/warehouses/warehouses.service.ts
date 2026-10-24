import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Warehouse } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

export interface WarehouseStockItem {
  variant_id: string;
  product_name: string;
  color: string | null;
  origin: string | null;
  total_stock: number;
}

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists all warehouses ordered by name.
   */
  async findAll(): Promise<Warehouse[]> {
    return this.prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Creates a new warehouse facility.
   */
  async create(dto: CreateWarehouseDto): Promise<{ data: Warehouse; message: string }> {
    const warehouse = await this.prisma.warehouse.create({
      data: {
        name: dto.name.trim(),
        location: dto.location?.trim() || null,
      },
    });

    return {
      data: warehouse,
      message: 'Warehouse created successfully.',
    };
  }

  /**
   * Updates an existing warehouse.
   * Only ADMIN users may call this.
   */
  async update(
    id: string,
    dto: UpdateWarehouseDto,
  ): Promise<{ data: Warehouse; message: string }> {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${id}" was not found.`);
    }

    const updateData: Prisma.WarehouseUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.location !== undefined) updateData.location = dto.location?.trim() || null;

    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: updateData,
    });

    return {
      data: updated,
      message: 'Warehouse updated successfully.',
    };
  }

  /**
   * Deletes a warehouse.
   * Data Protection Barrier: Blocks deletion if the warehouse has ever had
   * any entry in `inventory_transactions` (immutable ledger records).
   */
  async delete(id: string): Promise<{ message: string }> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: {
          select: { inventoryTransactions: true },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${id}" was not found.`);
    }

    if (warehouse._count.inventoryTransactions > 0) {
      throw new UnprocessableEntityException(
        'This warehouse cannot be deleted because it has inventory transactions.',
      );
    }

    await this.prisma.warehouse.delete({ where: { id } });

    return { message: 'Warehouse deleted successfully.' };
  }

  /**
   * Aggregates live stock for a specific warehouse directly from the
   * immutable `inventory_transactions` ledger.
   *
   * The query groups all ledger movements by variant, sums the signed
   * quantities (positive for IN, negative for OUT), then filters for
   * only variants that still have non-zero on-hand stock.
   */
  async getWarehouseStock(id: string): Promise<{ data: WarehouseStockItem[] }> {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${id}" was not found.`);
    }

    // Use raw SQL aggregation for performance on the high-volume ledger table
    const rows = await this.prisma.$queryRaw<
      Array<{
        variant_id: string;
        product_name: string;
        color: string | null;
        origin: string | null;
        total_stock: string; // Prisma returns DECIMAL as string from raw queries
      }>
    >`
      SELECT
        pv.id           AS variant_id,
        p.name          AS product_name,
        pv.color        AS color,
        pv.origin::TEXT AS origin,
        SUM(it.quantity)::NUMERIC AS total_stock
      FROM inventory_transactions it
      INNER JOIN product_variants pv ON pv.id = it.variant_id
      INNER JOIN products p          ON p.id  = pv.product_id
      WHERE it.warehouse_id = ${id}::UUID
      GROUP BY pv.id, p.name, pv.color, pv.origin
      HAVING SUM(it.quantity) != 0
      ORDER BY p.name ASC, pv.color ASC
    `;

    return {
      data: rows.map((row) => ({
        variant_id: row.variant_id,
        product_name: row.product_name,
        color: row.color,
        origin: row.origin,
        total_stock: parseFloat(row.total_stock),
      })),
    };
  }
}
