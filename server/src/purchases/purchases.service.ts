import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseMetadataDto } from './dto/update-purchase-metadata.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { QueryPurchaseDto } from './dto/query-purchase.dto';

// ─── Response shape for the list endpoint ────────────────────────────────────
export interface PurchaseWithItems {
  id: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  totalAmount: string | null; // Prisma Decimal → string for JSON safety
  purchaseDate: Date | null;
  status: TransactionStatus;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: Date;
  createdById: string | null;
  items: {
    id: string;
    variantId: string | null;
    quantity: string | null;
    unitCost: string | null;
    totalCost: string | null;
    variant: {
      id: string;
      sku: string | null;
      color: string | null;
      origin: string | null;
      product: { name: string } | null;
    } | null;
  }[];
}

export interface PaginatedPurchasesResponse {
  data: PurchaseWithItems[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Shared variant include fragment ─────────────────────────────────────────
const ITEM_INCLUDE = {
  variant: {
    select: {
      id: true,
      sku: true,
      color: true,
      origin: true,
      product: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. LIST ─────────────────────────────────────────────────────────────────

  async findAll(query: QueryPurchaseDto): Promise<PaginatedPurchasesResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    const orderDir = query.order === 'asc' ? 'asc' : 'desc';

    const where: Prisma.PurchaseWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.q?.trim()) {
      where.supplierName = { contains: query.q.trim(), mode: 'insensitive' };
    }

    if (query.date?.trim()) {
      // Filter by exact purchase_date
      const dateObj = new Date(query.date.trim());
      if (!isNaN(dateObj.getTime())) {
        where.purchaseDate = dateObj;
      }
    }

    const [total, purchases] = await Promise.all([
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.findMany({
        where,
        include: {
          items: {
            include: ITEM_INCLUDE,
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: orderDir },
      }),
    ]);

    return {
      data: purchases as unknown as PurchaseWithItems[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ── 2. CREATE ────────────────────────────────────────────────────────────────

  /**
   * Atomically creates a purchase, line items, inventory_transactions ledger
   * entries, cost layers, and weighted average valuation records.
   *
   * All mutations run inside a single Prisma transaction — if any step fails
   * the entire operation rolls back, leaving no orphaned database rows.
   */
  async createPurchase(
    dto: CreatePurchaseDto,
    userId: string,
  ): Promise<{ data: PurchaseWithItems; message: string }> {
    // ── Pre-flight: validate warehouse exists ─────────────────────────────────
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${dto.warehouseId}" was not found.`);
    }

    // ── Pre-flight: validate all variant IDs exist ────────────────────────────
    const variantIds = dto.items.map((i) => i.variantId);
    const existingVariants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true },
    });
    if (existingVariants.length !== variantIds.length) {
      const foundIds = new Set(existingVariants.map((v) => v.id));
      const missing = variantIds.filter((id) => !foundIds.has(id));
      throw new UnprocessableEntityException(
        `Product variant(s) not found: ${missing.join(', ')}`,
      );
    }

    // ── Atomic Transaction ────────────────────────────────────────────────────
    const purchase = await this.prisma.$transaction(async (tx) => {
      // 1. Create purchase header (total_amount starts at 0)
      const created = await tx.purchase.create({
        data: {
          supplierName: dto.supplierName?.trim() || null,
          invoiceNumber: dto.invoiceNumber?.trim() || null,
          purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
          notes: dto.notes?.trim() || null,
          status: TransactionStatus.POSTED,
          createdById: userId,
        },
      });

      let totalAmount = 0;

      for (const item of dto.items) {
        const qty = new Prisma.Decimal(item.quantity);
        const cost = new Prisma.Decimal(item.unitCost);
        const lineTotalDecimal = qty.mul(cost).toDecimalPlaces(2);
        const lineTotal = Number(lineTotalDecimal);
        totalAmount += lineTotal;

        // 2. Create purchase line item
        await tx.purchaseItem.create({
          data: {
            purchaseId: created.id,
            variantId: item.variantId,
            quantity: qty,
            unitCost: cost,
            totalCost: lineTotalDecimal,
          },
        });

        // 3. Write inventory ledger (+quantity PURCHASE movement)
        const txRow = await tx.inventoryTransaction.create({
          data: {
            variantId: item.variantId,
            warehouseId: dto.warehouseId,
            transactionType: TransactionType.PURCHASE,
            quantity: qty,
            unitCost: cost,
            referenceType: 'PURCHASE',
            referenceId: created.id,
            transactionDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
            createdById: userId,
          },
        });

        // 4. Create FIFO/LIFO cost layer
        await tx.inventoryCostLayer.create({
          data: {
            variantId: item.variantId,
            warehouseId: dto.warehouseId,
            remainingQty: qty,
            unitCost: cost,
            sourceTransactionId: txRow.id,
          },
        });

        // 5. Upsert Weighted Average pool
        const existing = await tx.inventoryValuation.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: dto.warehouseId,
            },
          },
        });

        if (existing) {
          const newQty = new Prisma.Decimal(existing.totalQuantity ?? 0).add(qty);
          const newCost = new Prisma.Decimal(existing.totalCost ?? 0).add(
            qty.mul(cost).toDecimalPlaces(4),
          );
          const newAvg = newQty.greaterThan(0)
            ? newCost.div(newQty).toDecimalPlaces(4)
            : new Prisma.Decimal(0);

          await tx.inventoryValuation.update({
            where: {
              variantId_warehouseId: {
                variantId: item.variantId,
                warehouseId: dto.warehouseId,
              },
            },
            data: {
              totalQuantity: newQty,
              totalCost: newCost,
              avgUnitCost: newAvg,
            },
          });
        } else {
          const totalCostVal = qty.mul(cost).toDecimalPlaces(4);
          const avgCost = qty.greaterThan(0)
            ? totalCostVal.div(qty).toDecimalPlaces(4)
            : new Prisma.Decimal(0);

          await tx.inventoryValuation.create({
            data: {
              variantId: item.variantId,
              warehouseId: dto.warehouseId,
              totalQuantity: qty,
              totalCost: totalCostVal,
              avgUnitCost: avgCost,
            },
          });
        }
      }

      // 6. Finalize purchase total
      await tx.purchase.update({
        where: { id: created.id },
        data: { totalAmount: new Prisma.Decimal(totalAmount).toDecimalPlaces(2) },
      });

      // Return freshly loaded record with all relations
      return tx.purchase.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: { include: ITEM_INCLUDE } },
      });
    });

    return {
      data: purchase as unknown as PurchaseWithItems,
      message: 'Purchase created successfully.',
    };
  }

  // ── 3. UPDATE METADATA ───────────────────────────────────────────────────────

  /**
   * Financial Immutability Rule: Only supplier_name and notes may be updated.
   * Quantities, costs, warehouse, and items remain permanently immutable.
   */
  async updateMetadata(
    id: string,
    dto: UpdatePurchaseMetadataDto,
  ): Promise<{ data: PurchaseWithItems; message: string }> {
    const purchase = await this.prisma.purchase.findUnique({ where: { id } });
    if (!purchase) {
      throw new NotFoundException(`Purchase with ID "${id}" was not found.`);
    }

    const updated = await this.prisma.purchase.update({
      where: { id },
      data: {
        ...(dto.supplierName !== undefined
          ? { supplierName: dto.supplierName?.trim() || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      include: { items: { include: ITEM_INCLUDE } },
    });

    return {
      data: updated as unknown as PurchaseWithItems,
      message: 'Purchase metadata updated successfully.',
    };
  }

  // ── 4. VOID ──────────────────────────────────────────────────────────────────

  /**
   * Voids a purchase order:
   * 1. Validates purchase is POSTED (not already voided)
   * 2. Depletes/removes unconsumed cost layers from inventory_cost_layers
   * 3. Decrements inventory_valuation pools
   * 4. Inserts compensating PURCHASE_RETURN ledger rows (negative quantities)
   * 5. Marks purchase.status = VOIDED
   */
  async voidPurchase(
    id: string,
    dto: VoidTransactionDto,
    userId: string,
  ): Promise<{ data: PurchaseWithItems; message: string }> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { items: { include: ITEM_INCLUDE } },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID "${id}" was not found.`);
    }

    if (purchase.status === TransactionStatus.VOIDED) {
      throw new UnprocessableEntityException(
        'This purchase is already voided and cannot be voided again.',
      );
    }

    // Discover the warehouse from the original inventory_transactions
    const originalTxRows = await this.prisma.inventoryTransaction.findMany({
      where: {
        referenceId: id,
        referenceType: 'PURCHASE',
        transactionType: TransactionType.PURCHASE,
      },
      select: { variantId: true, warehouseId: true, quantity: true, unitCost: true },
    });

    if (originalTxRows.length === 0) {
      throw new UnprocessableEntityException(
        'No inventory transactions found for this purchase. Cannot void.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const voidDate = dto.voidDate ? new Date(dto.voidDate) : new Date();

      for (const row of originalTxRows) {
        if (!row.variantId || !row.warehouseId) continue;

        const absQty = new Prisma.Decimal(row.quantity ?? 0).abs();

        // Insert compensating PURCHASE_RETURN (-quantity)
        await tx.inventoryTransaction.create({
          data: {
            variantId: row.variantId,
            warehouseId: row.warehouseId,
            transactionType: TransactionType.PURCHASE_RETURN,
            quantity: absQty.negated(),
            unitCost: row.unitCost,
            referenceType: 'VOID',
            referenceId: id,
            transactionDate: voidDate,
            createdById: userId,
          },
        });

        // Deplete unconsumed cost layers for this variant/warehouse from this purchase
        const layers = await tx.inventoryCostLayer.findMany({
          where: {
            variantId: row.variantId,
            warehouseId: row.warehouseId,
            remainingQty: { gt: 0 },
            sourceTransactionId: {
              in: (
                await tx.inventoryTransaction.findMany({
                  where: { referenceId: id, variantId: row.variantId },
                  select: { id: true },
                })
              ).map((t) => t.id),
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        for (const layer of layers) {
          await tx.inventoryCostLayer.update({
            where: { id: layer.id },
            data: { remainingQty: new Prisma.Decimal(0) },
          });
        }

        // Decrement inventory_valuation pool
        const valuation = await tx.inventoryValuation.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: row.variantId,
              warehouseId: row.warehouseId,
            },
          },
        });

        if (valuation) {
          const newQty = new Prisma.Decimal(valuation.totalQuantity ?? 0)
            .sub(absQty)
            .toDecimalPlaces(4);
          const costReduction = absQty
            .mul(new Prisma.Decimal(row.unitCost ?? 0))
            .toDecimalPlaces(4);
          const newCost = new Prisma.Decimal(valuation.totalCost ?? 0)
            .sub(costReduction)
            .toDecimalPlaces(4);
          const newAvg =
            newQty.greaterThan(0)
              ? newCost.div(newQty).toDecimalPlaces(4)
              : new Prisma.Decimal(0);

          await tx.inventoryValuation.update({
            where: {
              variantId_warehouseId: {
                variantId: row.variantId,
                warehouseId: row.warehouseId,
              },
            },
            data: {
              totalQuantity: newQty.lessThan(0) ? new Prisma.Decimal(0) : newQty,
              totalCost: newCost.lessThan(0) ? new Prisma.Decimal(0) : newCost,
              avgUnitCost: newAvg,
            },
          });
        }
      }

      // Mark purchase as VOIDED
      const noteAppend = dto.reason
        ? `\n[VOID ${voidDate.toISOString().slice(0, 10)}] ${dto.reason}`
        : `\n[VOID ${voidDate.toISOString().slice(0, 10)}]`;

      await tx.purchase.update({
        where: { id },
        data: {
          status: TransactionStatus.VOIDED,
          referenceType: 'VOID',
          notes: (purchase.notes ?? '') + noteAppend,
        },
      });
    });

    const voided = await this.prisma.purchase.findUniqueOrThrow({
      where: { id },
      include: { items: { include: ITEM_INCLUDE } },
    });

    return {
      data: voided as unknown as PurchaseWithItems,
      message: 'Purchase voided successfully.',
    };
  }

  // ── 5. PARTIAL RETURN ────────────────────────────────────────────────────────

  /**
   * Records a partial purchase return to vendor:
   * 1. Validates returned quantities don't exceed originally purchased amounts
   * 2. Depletes unconsumed cost layers proportionally
   * 3. Inserts PURCHASE_RETURN ledger rows (negative quantities)
   * 4. Updates notes on the parent purchase
   */
  async returnPurchase(
    id: string,
    dto: CreatePurchaseReturnDto,
    userId: string,
  ): Promise<{ message: string }> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID "${id}" was not found.`);
    }

    if (purchase.status === TransactionStatus.VOIDED) {
      throw new UnprocessableEntityException(
        'Cannot process a return on a voided purchase.',
      );
    }

    // Validate warehouse
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID "${dto.warehouseId}" was not found.`);
    }

    // Build a map of purchased quantities
    const purchasedQtyMap = new Map<string, Prisma.Decimal>();
    for (const item of purchase.items) {
      if (item.variantId) {
        purchasedQtyMap.set(
          item.variantId,
          new Prisma.Decimal(item.quantity ?? 0),
        );
      }
    }

    // Validate return items are from this purchase and quantities are valid
    for (const returnItem of dto.items) {
      const purchased = purchasedQtyMap.get(returnItem.variantId);
      if (!purchased) {
        throw new BadRequestException(
          `Variant "${returnItem.variantId}" was not part of this purchase.`,
        );
      }
      if (new Prisma.Decimal(returnItem.quantity).greaterThan(purchased)) {
        throw new UnprocessableEntityException(
          `Return quantity for variant "${returnItem.variantId}" exceeds the originally purchased quantity of ${purchased}.`,
        );
      }
    }

    const returnDate = dto.returnDate ? new Date(dto.returnDate) : new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const returnItem of dto.items) {
        const returnQty = new Prisma.Decimal(returnItem.quantity);

        // Get the original transaction for this variant in this purchase
        const origTx = await tx.inventoryTransaction.findFirst({
          where: {
            referenceId: id,
            variantId: returnItem.variantId,
            transactionType: TransactionType.PURCHASE,
          },
        });

        // Deplete available cost layers proportionally
        let remaining = returnQty;
        const layers = await tx.inventoryCostLayer.findMany({
          where: {
            variantId: returnItem.variantId,
            warehouseId: dto.warehouseId,
            remainingQty: { gt: 0 },
          },
          orderBy: { createdAt: 'asc' },
        });

        for (const layer of layers) {
          if (remaining.lessThanOrEqualTo(0)) break;
          const consume = Prisma.Decimal.min(
            new Prisma.Decimal(layer.remainingQty ?? 0),
            remaining,
          );
          await tx.inventoryCostLayer.update({
            where: { id: layer.id },
            data: {
              remainingQty: new Prisma.Decimal(layer.remainingQty ?? 0).sub(consume),
            },
          });
          remaining = remaining.sub(consume);
        }

        // Insert PURCHASE_RETURN ledger row (negative)
        await tx.inventoryTransaction.create({
          data: {
            variantId: returnItem.variantId,
            warehouseId: dto.warehouseId,
            transactionType: TransactionType.PURCHASE_RETURN,
            quantity: returnQty.negated(),
            unitCost: origTx?.unitCost ?? new Prisma.Decimal(0),
            referenceType: 'RETURN',
            referenceId: id,
            transactionDate: returnDate,
            createdById: userId,
          },
        });

        // Decrement valuation pool
        const valuation = await tx.inventoryValuation.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: returnItem.variantId,
              warehouseId: dto.warehouseId,
            },
          },
        });

        if (valuation) {
          const unitCostForCalc = origTx?.unitCost ?? new Prisma.Decimal(0);
          const newQty = new Prisma.Decimal(valuation.totalQuantity ?? 0)
            .sub(returnQty)
            .toDecimalPlaces(4);
          const newCost = new Prisma.Decimal(valuation.totalCost ?? 0)
            .sub(returnQty.mul(unitCostForCalc))
            .toDecimalPlaces(4);
          const newAvg =
            newQty.greaterThan(0)
              ? newCost.div(newQty).toDecimalPlaces(4)
              : new Prisma.Decimal(0);

          await tx.inventoryValuation.update({
            where: {
              variantId_warehouseId: {
                variantId: returnItem.variantId,
                warehouseId: dto.warehouseId,
              },
            },
            data: {
              totalQuantity: newQty.lessThan(0) ? new Prisma.Decimal(0) : newQty,
              totalCost: newCost.lessThan(0) ? new Prisma.Decimal(0) : newCost,
              avgUnitCost: newAvg,
            },
          });
        }
      }

      // Append return note
      const noteAppend = `\n[RETURN ${returnDate.toISOString().slice(0, 10)}] ${dto.notes ?? 'Partial return processed.'}`;
      await tx.purchase.update({
        where: { id },
        data: { notes: (purchase.notes ?? '') + noteAppend },
      });
    });

    return { message: 'Purchase return processed successfully.' };
  }
}
