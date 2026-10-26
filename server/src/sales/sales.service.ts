import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import {
  Prisma,
  TransactionStatus,
  TransactionType,
  CostingMethodName,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleMetadataDto } from './dto/update-sale-metadata.dto';
import { VoidTransactionDto } from './dto/void-transaction.dto';
import { CreateSaleReturnDto } from './dto/create-sale-return.dto';
import { QuerySaleDto } from './dto/query-sale.dto';

// ─── Shared relation include for Sales ───────────────────────────────────────
const SALE_INCLUDE = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  items: {
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          color: true,
          origin: true,
          thickness: true,
          size: true,
          product: {
            select: {
              id: true,
              name: true,
              baseUnit: true,
            },
          },
        },
      },
      cogsEntries: true,
    },
  },
} as const;

export type SaleRecord = Prisma.SaleGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

export interface PaginatedSalesResponse {
  data: SaleRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. LIST WITH FILTERS & PAGINATION ───────────────────────────────────────

  async findAll(query: QuerySaleDto): Promise<PaginatedSalesResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    const orderDir = query.order === 'asc' ? 'asc' : 'desc';

    const where: Prisma.SaleWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.q?.trim()) {
      where.customerName = { contains: query.q.trim(), mode: 'insensitive' };
    }

    if (query.date?.trim()) {
      const dateObj = new Date(query.date.trim());
      if (!isNaN(dateObj.getTime())) {
        // Date match range (entire day)
        const startOfDay = new Date(dateObj);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(dateObj);
        endOfDay.setUTCHours(23, 59, 59, 999);

        where.saleDate = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
    }

    const [total, sales] = await Promise.all([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ saleDate: orderDir }, { createdAt: 'desc' }],
        include: SALE_INCLUDE,
      }),
    ]);

    return {
      data: sales,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ── 2. GET SINGLE SALE ──────────────────────────────────────────────────────

  async findOne(id: string): Promise<SaleRecord> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID "${id}" was not found.`);
    }

    return sale;
  }

  // ── 3. CREATE SALE (FIFO COSTING & INVENTORY DEDUCTION) ─────────────────────

  async createSale(dto: CreateSaleDto, userId: string): Promise<SaleRecord> {
    // ── Pre-flight: validate warehouse exists ──────────────────────────────────
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID "${dto.warehouseId}" was not found.`,
      );
    }

    // ── Pre-flight: validate variant IDs exist ────────────────────────────────
    const variantIds = Array.from(new Set(dto.items.map((i) => i.variantId)));
    const existingVariants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    if (existingVariants.length !== variantIds.length) {
      const foundIds = new Set(existingVariants.map((v) => v.id));
      const missing = variantIds.filter((id) => !foundIds.has(id));
      throw new UnprocessableEntityException(
        `Product variant(s) not found: ${missing.join(', ')}`,
      );
    }
    const variantMap = new Map(existingVariants.map((v) => [v.id, v]));

    // ── Atomic Interactive Transaction ────────────────────────────────────────
    const createdSaleId = await this.prisma.$transaction(async (tx) => {
      // 1. Determine active costing method (defaults to FIFO)
      const setting = await tx.systemSetting.findFirst({
        include: { costingMethod: true },
      });
      const activeMethod: CostingMethodName =
        setting?.costingMethod?.name || CostingMethodName.FIFO;

      // 2. Aggregate requested quantities per variant
      const requestedByVariant = new Map<string, number>();
      for (const item of dto.items) {
        const cur = requestedByVariant.get(item.variantId) || 0;
        requestedByVariant.set(item.variantId, cur + Number(item.quantity));
      }

      // 3. Concurrency check & Stock availability verification in cost layers
      for (const [vId, reqQty] of requestedByVariant.entries()) {
        const layers = await tx.inventoryCostLayer.findMany({
          where: {
            variantId: vId,
            warehouseId: dto.warehouseId,
            remainingQty: { gt: 0 },
          },
          orderBy:
            activeMethod === CostingMethodName.LIFO
              ? { createdAt: 'desc' }
              : { createdAt: 'asc' },
        });

        const totalAvailable = layers.reduce(
          (sum, l) => sum + Number(l.remainingQty ?? 0),
          0,
        );

        if (totalAvailable < reqQty) {
          const v = variantMap.get(vId);
          const vLabel = v
            ? `${v.product?.name ?? 'Item'} - ${v.sku || 'No SKU'} (${v.color || ''})`
            : vId;
          throw new UnprocessableEntityException(
            `Not enough available stock in the selected warehouse for variant: ${vLabel}. In stock: ${totalAvailable.toFixed(
              2,
            )}, requested: ${reqQty.toFixed(2)}.`,
          );
        }
      }

      // 4. Create Sale master header
      const saleDate = dto.saleDate ? new Date(dto.saleDate) : new Date();
      const sale = await tx.sale.create({
        data: {
          customerName: dto.customerName.trim(),
          saleDate,
          notes: dto.notes?.trim() || null,
          status: TransactionStatus.POSTED,
          referenceType: 'SALE',
          createdById: userId,
        },
      });

      let grandTotalAmount = new Prisma.Decimal(0);

      // 5. Process each sale line item
      for (const item of dto.items) {
        const qty = new Prisma.Decimal(item.quantity);
        const price = new Prisma.Decimal(item.sellingPrice);
        const lineTotal = qty.mul(price).toDecimalPlaces(2);
        grandTotalAmount = grandTotalAmount.add(lineTotal);

        // 5a. Create sale item row
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            variantId: item.variantId,
            quantity: qty,
            sellingPrice: price,
            totalPrice: lineTotal,
          },
        });

        // 5b. Fetch candidate cost layers for FIFO/LIFO consumption
        const candidateLayers = await tx.inventoryCostLayer.findMany({
          where: {
            variantId: item.variantId,
            warehouseId: dto.warehouseId,
            remainingQty: { gt: 0 },
          },
          orderBy:
            activeMethod === CostingMethodName.LIFO
              ? { createdAt: 'desc' }
              : { createdAt: 'asc' },
        });

        let remainingToConsume = Number(qty);
        let totalCostOfItem = new Prisma.Decimal(0);

        for (const layer of candidateLayers) {
          if (remainingToConsume <= 0) break;

          const layerAvail = Number(layer.remainingQty ?? 0);
          if (layerAvail <= 0) continue;

          const take = Math.min(layerAvail, remainingToConsume);
          const takeDec = new Prisma.Decimal(take);
          const layerUnitCost = new Prisma.Decimal(layer.unitCost ?? 0);
          const layerCostTotal = takeDec.mul(layerUnitCost).toDecimalPlaces(2);
          totalCostOfItem = totalCostOfItem.add(layerCostTotal);

          // Atomic reduction of remaining_qty
          await tx.inventoryCostLayer.update({
            where: { id: layer.id },
            data: {
              remainingQty: { decrement: takeDec },
            },
          });

          // Permanent frozen snapshot in cogs_entries
          await tx.cogsEntry.create({
            data: {
              saleItemId: saleItem.id,
              variantId: item.variantId,
              quantity: takeDec,
              unitCost: layerUnitCost,
              totalCost: layerCostTotal,
              costingMethod: activeMethod,
              sourceLayerId: layer.id,
            },
          });

          remainingToConsume -= take;
        }

        // 5c. Outbound negative inventory transaction (-quantity)
        const effectiveUnitCost = qty.greaterThan(0)
          ? totalCostOfItem.div(qty).toDecimalPlaces(4)
          : new Prisma.Decimal(0);

        await tx.inventoryTransaction.create({
          data: {
            variantId: item.variantId,
            warehouseId: dto.warehouseId,
            transactionType: TransactionType.SALE,
            quantity: qty.negated(),
            unitCost: effectiveUnitCost,
            referenceType: 'SALE',
            referenceId: sale.id,
            transactionDate: saleDate,
            createdById: userId,
          },
        });

        // 5d. Maintain Weighted Average pool in inventory_valuation
        const valuation = await tx.inventoryValuation.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: item.variantId,
              warehouseId: dto.warehouseId,
            },
          },
        });

        if (valuation) {
          const curQty = new Prisma.Decimal(valuation.totalQuantity ?? 0);
          const curCost = new Prisma.Decimal(valuation.totalCost ?? 0);
          const nextQty = curQty.sub(qty);
          const nextCost = curCost.sub(totalCostOfItem);

          const safeQty = nextQty.greaterThan(0)
            ? nextQty
            : new Prisma.Decimal(0);
          const safeCost = nextCost.greaterThan(0)
            ? nextCost
            : new Prisma.Decimal(0);
          const nextAvg = safeQty.greaterThan(0)
            ? safeCost.div(safeQty).toDecimalPlaces(4)
            : new Prisma.Decimal(0);

          await tx.inventoryValuation.update({
            where: {
              variantId_warehouseId: {
                variantId: item.variantId,
                warehouseId: dto.warehouseId,
              },
            },
            data: {
              totalQuantity: safeQty,
              totalCost: safeCost,
              avgUnitCost: nextAvg,
            },
          });
        }
      }

      // 6. Update master total_amount
      await tx.sale.update({
        where: { id: sale.id },
        data: { totalAmount: grandTotalAmount },
      });

      return sale.id;
    });

    return this.findOne(createdSaleId);
  }

  // ── 4. SAFE METADATA UPDATE ─────────────────────────────────────────────────

  async updateMetadata(
    id: string,
    dto: UpdateSaleMetadataDto,
  ): Promise<SaleRecord> {
    const sale = await this.prisma.sale.findUnique({ where: { id } });
    if (!sale) {
      throw new NotFoundException(`Sale with ID "${id}" was not found.`);
    }

    const updateData: Prisma.SaleUpdateInput = {};
    if (dto.customerName !== undefined) {
      updateData.customerName = dto.customerName.trim();
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes?.trim() || null;
    }

    await this.prisma.sale.update({
      where: { id },
      data: updateData,
    });

    return this.findOne(id);
  }

  // ── 5. VOID SALE (FULL CANCELLATION & INVENTORY RESTORATION) ────────────────

  async voidSale(
    id: string,
    dto: VoidTransactionDto,
    userId: string,
  ): Promise<{ message: string; data: SaleRecord }> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            cogsEntries: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID "${id}" was not found.`);
    }

    if (sale.status === TransactionStatus.VOIDED) {
      throw new BadRequestException('This sale is already voided.');
    }

    // Locate the original warehouse from inventory transactions
    const origTx = await this.prisma.inventoryTransaction.findFirst({
      where: {
        referenceId: sale.id,
        transactionType: TransactionType.SALE,
      },
    });
    const warehouseId = origTx?.warehouseId;

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark Sale as VOIDED with audit note
      const voidDate = dto.voidDate ? new Date(dto.voidDate) : new Date();
      const existingNotes = sale.notes ? `${sale.notes}\n` : '';
      const auditNote = `${existingNotes}[VOIDED on ${voidDate.toISOString().slice(0, 10)}]: ${dto.reason.trim()}`;

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: TransactionStatus.VOIDED,
          referenceType: 'VOID',
          notes: auditNote,
        },
      });

      // 2. Reverse each line item: restock goods and restore cost layers
      for (const item of sale.items) {
        if (!item.variantId) continue;

        const returnQty = new Prisma.Decimal(item.quantity ?? 0);
        if (returnQty.lessThanOrEqualTo(0)) continue;

        // 2a. Insert positive inventory ledger movement (+quantity SALE_RETURN)
        if (warehouseId) {
          await tx.inventoryTransaction.create({
            data: {
              variantId: item.variantId,
              warehouseId,
              transactionType: TransactionType.SALE_RETURN,
              quantity: returnQty,
              unitCost: new Prisma.Decimal(0),
              referenceType: 'VOID',
              referenceId: sale.id,
              transactionDate: voidDate,
              createdById: userId,
            },
          });
        }

        // 2b. Re-credit consumed quantities back to original inventory_cost_layers
        let totalCostRestored = new Prisma.Decimal(0);

        for (const cogs of item.cogsEntries) {
          const cogsQty = new Prisma.Decimal(cogs.quantity ?? 0);
          totalCostRestored = totalCostRestored.add(
            new Prisma.Decimal(cogs.totalCost ?? 0),
          );

          if (cogs.sourceLayerId) {
            const layer = await tx.inventoryCostLayer.findUnique({
              where: { id: cogs.sourceLayerId },
            });
            if (layer) {
              await tx.inventoryCostLayer.update({
                where: { id: cogs.sourceLayerId },
                data: {
                  remainingQty: { increment: cogsQty },
                },
              });
              continue;
            }
          }

          // Fallback: create fresh layer if original layer was somehow removed
          if (warehouseId) {
            await tx.inventoryCostLayer.create({
              data: {
                variantId: item.variantId,
                warehouseId,
                remainingQty: cogsQty,
                unitCost: cogs.unitCost ?? 0,
              },
            });
          }
        }

        // 2c. Restore Weighted Average valuation
        if (warehouseId) {
          const val = await tx.inventoryValuation.findUnique({
            where: {
              variantId_warehouseId: {
                variantId: item.variantId,
                warehouseId,
              },
            },
          });
          if (val) {
            const nextQty = new Prisma.Decimal(val.totalQuantity ?? 0).add(
              returnQty,
            );
            const nextCost = new Prisma.Decimal(val.totalCost ?? 0).add(
              totalCostRestored,
            );
            const nextAvg = nextQty.greaterThan(0)
              ? nextCost.div(nextQty).toDecimalPlaces(4)
              : new Prisma.Decimal(0);

            await tx.inventoryValuation.update({
              where: {
                variantId_warehouseId: {
                  variantId: item.variantId,
                  warehouseId,
                },
              },
              data: {
                totalQuantity: nextQty,
                totalCost: nextCost,
                avgUnitCost: nextAvg,
              },
            });
          }
        }
      }
    });

    const updated = await this.findOne(id);
    return {
      message: 'Sale voided successfully and inventory restored.',
      data: updated,
    };
  }

  // ── 6. PARTIAL CUSTOMER RETURN (RETURN_SALE) ───────────────────────────────

  async returnSale(
    id: string,
    dto: CreateSaleReturnDto,
    userId: string,
  ): Promise<{ message: string; data: SaleRecord }> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            cogsEntries: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID "${id}" was not found.`);
    }

    if (sale.status === TransactionStatus.VOIDED) {
      throw new BadRequestException('Cannot return items from a voided sale.');
    }

    // Verify warehouse exists
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID "${dto.warehouseId}" was not found.`,
      );
    }

    // Query previous returns for this sale to ensure return quantity <= remaining quantity
    const prevReturns = await this.prisma.inventoryTransaction.findMany({
      where: {
        referenceId: sale.id,
        transactionType: TransactionType.SALE_RETURN,
      },
    });

    const returnedTotalsByVariant = new Map<string, number>();
    for (const ret of prevReturns) {
      if (ret.variantId && ret.quantity) {
        const cur = returnedTotalsByVariant.get(ret.variantId) || 0;
        returnedTotalsByVariant.set(
          ret.variantId,
          cur + Math.abs(Number(ret.quantity)),
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      let revenueReduction = new Prisma.Decimal(0);
      const returnDate = dto.returnDate ? new Date(dto.returnDate) : new Date();

      for (const returnItem of dto.items) {
        const matchingSaleItem = sale.items.find(
          (i) => i.variantId === returnItem.variantId,
        );
        if (!matchingSaleItem) {
          throw new UnprocessableEntityException(
            `Variant "${returnItem.variantId}" is not part of this original sale order.`,
          );
        }

        const soldQty = Number(matchingSaleItem.quantity ?? 0);
        const alreadyReturned =
          returnedTotalsByVariant.get(returnItem.variantId) || 0;
        const maxReturnable = soldQty - alreadyReturned;

        if (returnItem.quantity > maxReturnable) {
          throw new UnprocessableEntityException(
            `Cannot return ${returnItem.quantity} units for variant "${returnItem.variantId}". Maximum remaining returnable quantity is ${maxReturnable}.`,
          );
        }

        const retQtyDec = new Prisma.Decimal(returnItem.quantity);
        const unitPrice = new Prisma.Decimal(
          matchingSaleItem.sellingPrice ?? 0,
        );
        const itemRevenueDelta = retQtyDec.mul(unitPrice).toDecimalPlaces(2);
        revenueReduction = revenueReduction.add(itemRevenueDelta);

        // 1. Write compensating positive inventory movement
        await tx.inventoryTransaction.create({
          data: {
            variantId: returnItem.variantId,
            warehouseId: dto.warehouseId,
            transactionType: TransactionType.SALE_RETURN,
            quantity: retQtyDec,
            unitCost: new Prisma.Decimal(0),
            referenceType: 'RETURN',
            referenceId: sale.id,
            transactionDate: returnDate,
            createdById: userId,
          },
        });

        // 2. Restore cost layers proportionally
        // Find cogs entries for this sale item ordered by latest first
        let qtyToRestore = Number(retQtyDec);
        let itemCostRestored = new Prisma.Decimal(0);

        for (const cogs of matchingSaleItem.cogsEntries) {
          if (qtyToRestore <= 0) break;
          const cogsQty = Number(cogs.quantity ?? 0);
          const take = Math.min(cogsQty, qtyToRestore);
          const takeDec = new Prisma.Decimal(take);
          const unitCost = new Prisma.Decimal(cogs.unitCost ?? 0);
          itemCostRestored = itemCostRestored.add(
            takeDec.mul(unitCost).toDecimalPlaces(2),
          );

          if (cogs.sourceLayerId) {
            const layer = await tx.inventoryCostLayer.findUnique({
              where: { id: cogs.sourceLayerId },
            });
            if (layer) {
              await tx.inventoryCostLayer.update({
                where: { id: cogs.sourceLayerId },
                data: { remainingQty: { increment: takeDec } },
              });
            } else {
              await tx.inventoryCostLayer.create({
                data: {
                  variantId: returnItem.variantId,
                  warehouseId: dto.warehouseId,
                  remainingQty: takeDec,
                  unitCost,
                },
              });
            }
          } else {
            await tx.inventoryCostLayer.create({
              data: {
                variantId: returnItem.variantId,
                warehouseId: dto.warehouseId,
                remainingQty: takeDec,
                unitCost,
              },
            });
          }

          qtyToRestore -= take;
        }

        // 3. Restore Weighted Average valuation
        const val = await tx.inventoryValuation.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: returnItem.variantId,
              warehouseId: dto.warehouseId,
            },
          },
        });
        if (val) {
          const nextQty = new Prisma.Decimal(val.totalQuantity ?? 0).add(
            retQtyDec,
          );
          const nextCost = new Prisma.Decimal(val.totalCost ?? 0).add(
            itemCostRestored,
          );
          const nextAvg = nextQty.greaterThan(0)
            ? nextCost.div(nextQty).toDecimalPlaces(4)
            : new Prisma.Decimal(0);

          await tx.inventoryValuation.update({
            where: {
              variantId_warehouseId: {
                variantId: returnItem.variantId,
                warehouseId: dto.warehouseId,
              },
            },
            data: {
              totalQuantity: nextQty,
              totalCost: nextCost,
              avgUnitCost: nextAvg,
            },
          });
        }
      }

      // 4. Reduce sale total_amount and append return note
      const currentTotal = new Prisma.Decimal(sale.totalAmount ?? 0);
      const newTotal = currentTotal.sub(revenueReduction);
      const safeNewTotal = newTotal.greaterThan(0)
        ? newTotal
        : new Prisma.Decimal(0);

      const existingNotes = sale.notes ? `${sale.notes}\n` : '';
      const returnNote = dto.notes?.trim()
        ? ` [Notes: ${dto.notes.trim()}]`
        : '';
      const updatedNotes = `${existingNotes}[RETURN on ${returnDate.toISOString().slice(0, 10)}]: Returned items valued at ${revenueReduction.toFixed(2)}${returnNote}`;

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          totalAmount: safeNewTotal,
          notes: updatedNotes,
        },
      });
    });

    const updated = await this.findOne(id);
    return {
      message: 'Customer return processed successfully and inventory restored.',
      data: updated,
    };
  }
}
