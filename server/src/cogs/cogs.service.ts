import { Injectable } from '@nestjs/common';
import {
  TransactionStatus,
  TransactionType,
  CostingMethodName,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCogsDto } from './dto/query-cogs.dto';

export interface CogsVariantItem {
  variant_id: string;
  product_name: string;
  color: string;
  origin: string;
  quantity_sold: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  profit_margin: number;
}

export interface CogsSummary {
  total_revenue: number;
  total_cogs: number;
  total_gross_profit: number;
  profit_margin: number;
}

export interface CogsReportResponse {
  active_method: CostingMethodName;
  selected_method: CostingMethodName;
  is_simulated: boolean;
  start_date: string;
  end_date: string;
  summary: CogsSummary;
  data: CogsVariantItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface InboundLayer {
  quantity: number;
  unitCost: number;
}

@Injectable()
export class CogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the company's active costing method from system_settings.
   * Defaults to FIFO if unconfigured.
   */
  async getActiveCostingMethod(): Promise<CostingMethodName> {
    const setting = await this.prisma.systemSetting.findFirst({
      include: { costingMethod: true },
    });
    return setting?.costingMethod?.name || CostingMethodName.FIFO;
  }

  /**
   * Generates COGS Report with dual path:
   * 1. Active Method Path: High-speed aggregation from stored cogs_entries and posted sales.
   * 2. Simulation Path: Replays raw inventory timeline in memory for alternative methods
   *    without mutating persistent database tables.
   */
  async generateReport(query: QueryCogsDto): Promise<CogsReportResponse> {
    const activeMethod = await this.getActiveCostingMethod();

    const selectedMethod: CostingMethodName =
      query.costingMethod || query.costing_method || activeMethod;

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(
      1,
      Math.min(100, Number(query.limit || query.per_page) || 10),
    );

    // Default to current month window if dates are not provided
    const now = new Date();
    const defaultStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    )
      .toISOString()
      .slice(0, 10);
    const defaultEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    )
      .toISOString()
      .slice(0, 10);

    const startDateStr = query.startDate || query.start_date || defaultStart;
    const endDateStr = query.endDate || query.end_date || defaultEnd;

    const start = new Date(`${startDateStr}T00:00:00.000Z`);
    const end = new Date(`${endDateStr}T23:59:59.999Z`);

    const isSimulated = selectedMethod !== activeMethod;

    let variantItems: CogsVariantItem[] = [];

    if (!isSimulated) {
      variantItems = await this.calculateActiveCogs(start, end, activeMethod);
    } else {
      variantItems = await this.simulateDynamicCogs(start, end, selectedMethod);
    }

    // Sort by product name ascending, color ascending
    variantItems.sort((a, b) => {
      const nameDiff = a.product_name.localeCompare(b.product_name);
      if (nameDiff !== 0) return nameDiff;
      return a.color.localeCompare(b.color);
    });

    // Summary calculations
    const totalRevenue = variantItems.reduce((acc, i) => acc + i.revenue, 0);
    const totalCogs = variantItems.reduce((acc, i) => acc + i.cogs, 0);
    const totalGrossProfit = totalRevenue - totalCogs;
    const overallMargin =
      totalRevenue > 0
        ? Math.round((totalGrossProfit / totalRevenue) * 100 * 100) / 100
        : 0;

    const summary: CogsSummary = {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_cogs: Math.round(totalCogs * 100) / 100,
      total_gross_profit: Math.round(totalGrossProfit * 100) / 100,
      profit_margin: overallMargin,
    };

    // Pagination
    const total = variantItems.length;
    const startIndex = (page - 1) * limit;
    const pagedData = variantItems.slice(startIndex, startIndex + limit);

    return {
      active_method: activeMethod,
      selected_method: selectedMethod,
      is_simulated: isSimulated,
      start_date: startDateStr,
      end_date: endDateStr,
      summary,
      data: pagedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Fast Path: Aggregates stored cogs_entries for posted sales in the given date range.
   */
  private async calculateActiveCogs(
    start: Date,
    end: Date,
    activeMethod: CostingMethodName,
  ): Promise<CogsVariantItem[]> {
    const postedSales = await this.prisma.sale.findMany({
      where: {
        status: TransactionStatus.POSTED,
        saleDate: { gte: start, lte: end },
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
            cogsEntries: true,
          },
        },
      },
    });

    const variantMap = new Map<
      string,
      {
        product_name: string;
        color: string;
        origin: string;
        quantity_sold: number;
        revenue: number;
        cogs: number;
      }
    >();

    for (const sale of postedSales) {
      for (const item of sale.items) {
        if (!item.variantId || !item.variant) continue;

        const vId = item.variantId;
        const pName = item.variant.product?.name || 'Unknown Product';
        const color = item.variant.color || '-';
        const origin = item.variant.origin || '-';

        const lineQty = Number(item.quantity ?? 0);
        const lineRev = Number(item.totalPrice ?? 0);

        // Sum COGS entries matching active method (or all frozen snapshots for this line)
        const lineCogs = item.cogsEntries
          .filter((e) => !e.costingMethod || e.costingMethod === activeMethod)
          .reduce((sum, e) => sum + Number(e.totalCost ?? 0), 0);

        const current = variantMap.get(vId) || {
          product_name: pName,
          color,
          origin,
          quantity_sold: 0,
          revenue: 0,
          cogs: 0,
        };

        current.quantity_sold += lineQty;
        current.revenue += lineRev;
        current.cogs += lineCogs;

        variantMap.set(vId, current);
      }
    }

    const items: CogsVariantItem[] = [];

    for (const [vId, val] of variantMap.entries()) {
      const grossProfit = val.revenue - val.cogs;
      const margin =
        val.revenue > 0
          ? Math.round((grossProfit / val.revenue) * 100 * 100) / 100
          : 0;

      items.push({
        variant_id: vId,
        product_name: val.product_name,
        color: val.color,
        origin: val.origin,
        quantity_sold: Math.round(val.quantity_sold * 10000) / 10000,
        revenue: Math.round(val.revenue * 100) / 100,
        cogs: Math.round(val.cogs * 100) / 100,
        gross_profit: Math.round(grossProfit * 100) / 100,
        profit_margin: margin,
      });
    }

    return items;
  }

  /**
   * Deep Path: Dynamic In-Memory Simulation Replay.
   * Replays chronological inventory transactions up to `end` to compute hypothetical COGS
   * under FIFO, LIFO, or Weighted Average without mutating persistent database state.
   */
  private async simulateDynamicCogs(
    start: Date,
    end: Date,
    targetMethod: CostingMethodName,
  ): Promise<CogsVariantItem[]> {
    // 1. Fetch all inventory movements up to end date (ordered chronologically)
    const transactions = await this.prisma.inventoryTransaction.findMany({
      where: {
        transactionDate: { lte: end },
        referenceType: { not: 'VOID' },
      },
      include: {
        variant: {
          include: { product: true },
        },
      },
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    });

    // 2. Fetch posted sales in the window [start, end] to get actual revenue
    const postedSalesInWindow = await this.prisma.sale.findMany({
      where: {
        status: TransactionStatus.POSTED,
        saleDate: { gte: start, lte: end },
      },
      include: {
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
    });

    // Map variant revenues & sold quantities in window
    const windowSalesMap = new Map<
      string,
      {
        product_name: string;
        color: string;
        origin: string;
        quantity_sold: number;
        revenue: number;
      }
    >();

    for (const sale of postedSalesInWindow) {
      for (const item of sale.items) {
        if (!item.variantId || !item.variant) continue;
        const vId = item.variantId;
        const current = windowSalesMap.get(vId) || {
          product_name: item.variant.product?.name || 'Unknown Product',
          color: item.variant.color || '-',
          origin: item.variant.origin || '-',
          quantity_sold: 0,
          revenue: 0,
        };
        current.quantity_sold += Number(item.quantity ?? 0);
        current.revenue += Number(item.totalPrice ?? 0);
        windowSalesMap.set(vId, current);
      }
    }

    // 3. Group timeline movements by variant and warehouse
    const txByVariantWh = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      if (!tx.variantId) continue;
      const key = `${tx.variantId}:${tx.warehouseId || 'default'}`;
      const list = txByVariantWh.get(key) || [];
      list.push(tx);
      txByVariantWh.set(key, list);
    }

    // 4. Run in-memory simulation per variant & warehouse
    const simulatedCogsByVariant = new Map<string, number>();

    for (const [key, movements] of txByVariantWh.entries()) {
      const [vId] = key.split(':');

      if (targetMethod === CostingMethodName.WEIGHTED_AVERAGE) {
        // Weighted Moving Average state
        let poolQty = 0;
        let poolCost = 0;
        let poolAvg = 0;

        for (const m of movements) {
          const qty = Number(m.quantity ?? 0);
          const unitCost = Number(m.unitCost ?? 0);
          const mDate = m.transactionDate || m.createdAt;
          const isInWindow = mDate >= start && mDate <= end;

          if (
            m.transactionType === TransactionType.PURCHASE ||
            m.referenceType === 'INITIAL_STOCK' ||
            qty > 0
          ) {
            if (m.transactionType === TransactionType.SALE_RETURN) {
              // Re-credit returned units
              poolQty += qty;
              poolCost += qty * poolAvg;
            } else {
              // Inbound Purchase: recalculate moving average
              const inboundCost = qty * unitCost;
              const newQty = poolQty + qty;
              const newCost = poolCost + inboundCost;
              poolAvg = newQty > 0 ? newCost / newQty : 0;
              poolQty = newQty;
              poolCost = newCost;
            }
          } else if (m.transactionType === TransactionType.SALE || qty < 0) {
            // Outbound Sale: consumes at current moving average
            const soldQty = Math.abs(qty);
            const saleCogs = soldQty * poolAvg;
            poolQty = Math.max(0, poolQty - soldQty);
            poolCost = Math.max(0, poolCost - saleCogs);

            if (isInWindow) {
              const cur = simulatedCogsByVariant.get(vId) || 0;
              simulatedCogsByVariant.set(vId, cur + saleCogs);
            }
          }
        }
      } else {
        // FIFO or LIFO Layer State
        const layers: InboundLayer[] = [];

        for (const m of movements) {
          const qty = Number(m.quantity ?? 0);
          const unitCost = Number(m.unitCost ?? 0);
          const mDate = m.transactionDate || m.createdAt;
          const isInWindow = mDate >= start && mDate <= end;

          if (
            m.transactionType === TransactionType.PURCHASE ||
            m.referenceType === 'INITIAL_STOCK' ||
            qty > 0
          ) {
            // Add inbound layer
            layers.push({
              quantity: qty,
              unitCost,
            });
          } else if (m.transactionType === TransactionType.SALE || qty < 0) {
            // Consume layers
            let needed = Math.abs(qty);
            let saleCogs = 0;

            if (targetMethod === CostingMethodName.FIFO) {
              // FIFO: consume oldest (front of queue)
              for (let i = 0; i < layers.length; i++) {
                if (needed <= 0) break;
                const layer = layers[i];
                if (layer.quantity <= 0) continue;

                const take = Math.min(layer.quantity, needed);
                saleCogs += take * layer.unitCost;
                layer.quantity -= take;
                needed -= take;
              }
            } else {
              // LIFO: consume newest (back of stack)
              for (let i = layers.length - 1; i >= 0; i--) {
                if (needed <= 0) break;
                const layer = layers[i];
                if (layer.quantity <= 0) continue;

                const take = Math.min(layer.quantity, needed);
                saleCogs += take * layer.unitCost;
                layer.quantity -= take;
                needed -= take;
              }
            }

            if (isInWindow) {
              const cur = simulatedCogsByVariant.get(vId) || 0;
              simulatedCogsByVariant.set(vId, cur + saleCogs);
            }
          }
        }
      }
    }

    // 5. Construct results for all variants with activity in window
    const results: CogsVariantItem[] = [];

    for (const [vId, salesInfo] of windowSalesMap.entries()) {
      const cogs = simulatedCogsByVariant.get(vId) || 0;
      const grossProfit = salesInfo.revenue - cogs;
      const margin =
        salesInfo.revenue > 0
          ? Math.round((grossProfit / salesInfo.revenue) * 100 * 100) / 100
          : 0;

      results.push({
        variant_id: vId,
        product_name: salesInfo.product_name,
        color: salesInfo.color,
        origin: salesInfo.origin,
        quantity_sold: Math.round(salesInfo.quantity_sold * 10000) / 10000,
        revenue: Math.round(salesInfo.revenue * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        gross_profit: Math.round(grossProfit * 100) / 100,
        profit_margin: margin,
      });
    }

    return results;
  }

  /**
   * Generates a downloadable CSV string conforming to compliance guidelines.
   */
  async exportCsv(
    query: QueryCogsDto,
  ): Promise<{ filename: string; csv: string }> {
    const report = await this.generateReport({
      ...query,
      limit: 10000,
      page: 1,
    });

    const header = [
      'Product Name',
      'Color',
      'Origin',
      'Quantity Sold',
      'Revenue',
      'COGS',
      'Gross Profit',
      'Profit Margin %',
    ].join(',');

    const rows = report.data.map((item) => {
      const pName = `"${item.product_name.replace(/"/g, '""')}"`;
      const color = `"${item.color.replace(/"/g, '""')}"`;
      const origin = `"${item.origin.replace(/"/g, '""')}"`;
      const qty = item.quantity_sold;
      const rev = item.revenue.toFixed(2);
      const cogs = item.cogs.toFixed(2);
      const gp = item.gross_profit.toFixed(2);
      const margin = item.profit_margin.toFixed(2);

      return `${pName},${color},${origin},${qty},${rev},${cogs},${gp},${margin}`;
    });

    const csv = [header, ...rows].join('\n');
    const filename = `cogs-${report.selected_method}-${report.start_date}-${report.end_date}.csv`;

    return { filename, csv };
  }
}
