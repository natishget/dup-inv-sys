import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

export interface MonthlyTrendItem {
  month: string;
  shortMonth: string;
  year: number;
  monthIndex: number; // 0-11
  revenue: number;
  purchases: number;
  cogs: number;
  grossProfit: number;
}

export interface TopVariantItem {
  variantId: string;
  productName: string;
  sku: string;
  color: string;
  origin: string;
  size: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  profitMargin: number;
}

export interface DashboardMetricsResponse {
  fiscalYear: string;
  startDate: string | null;
  endDate: string | null;
  kpis: {
    totalSales: number;
    salesCount: number;
    totalPurchases: number;
    purchasesCount: number;
    totalCogs: number;
    grossProfit: number;
    profitMargin: number;
    totalInventoryValue: number;
    totalInventoryUnits: number;
    productsCount: number;
    variantsCount: number;
  };
  monthlyTrend: MonthlyTrendItem[];
  topVariants: TopVariantItem[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(query: QueryDashboardDto): Promise<DashboardMetricsResponse> {
    const { fiscalYear, startDate, endDate, monthDefinitions } =
      this.resolveFiscalPeriod(query);

    // Build date filters for posted sales and purchases
    const dateFilterSales =
      startDate && endDate ? { saleDate: { gte: startDate, lte: endDate } } : {};

    const dateFilterPurchases =
      startDate && endDate
        ? { purchaseDate: { gte: startDate, lte: endDate } }
        : {};

    // 1. Query Posted Sales with items and COGS entries
    const postedSales = await this.prisma.sale.findMany({
      where: {
        status: TransactionStatus.POSTED,
        ...dateFilterSales,
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
      orderBy: { saleDate: 'asc' },
    });

    // 2. Query Posted Purchases
    const postedPurchases = await this.prisma.purchase.findMany({
      where: {
        status: TransactionStatus.POSTED,
        ...dateFilterPurchases,
      },
      include: {
        items: true,
      },
      orderBy: { purchaseDate: 'asc' },
    });

    // 3. Query Catalog and Live Inventory Valuations
    const [productsCount, variantsCount, valuations] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.productVariant.count(),
      this.prisma.inventoryValuation.findMany(),
    ]);

    // 4. Calculate Aggregate KPIs
    let totalSales = 0;
    let totalCogs = 0;

    // Track variant sales aggregation for Top Products
    const variantSalesMap = new Map<
      string,
      {
        variantId: string;
        productName: string;
        sku: string;
        color: string;
        origin: string;
        size: string;
        unitsSold: number;
        revenue: number;
        cogs: number;
      }
    >();

    for (const sale of postedSales) {
      totalSales += Number(sale.totalAmount ?? 0);

      for (const item of sale.items) {
        const itemRevenue = Number(item.totalPrice ?? 0);
        const itemUnits = Number(item.quantity ?? 0);
        let itemCogs = 0;

        for (const cogs of item.cogsEntries) {
          itemCogs += Number(cogs.totalCost ?? 0);
        }

        totalCogs += itemCogs;

        if (item.variantId && item.variant) {
          const v = item.variant;
          const existing = variantSalesMap.get(item.variantId) || {
            variantId: item.variantId,
            productName: v.product?.name ?? 'Unknown Product',
            sku: v.sku ?? '',
            color: v.color ?? '',
            origin: v.origin ?? '',
            size: v.size ?? '',
            unitsSold: 0,
            revenue: 0,
            cogs: 0,
          };

          existing.unitsSold += itemUnits;
          existing.revenue += itemRevenue;
          existing.cogs += itemCogs;
          variantSalesMap.set(item.variantId, existing);
        }
      }
    }

    let totalPurchases = 0;
    for (const p of postedPurchases) {
      totalPurchases += Number(p.totalAmount ?? 0);
    }

    const grossProfit = Math.round((totalSales - totalCogs) * 100) / 100;
    const profitMargin =
      totalSales > 0
        ? Math.round((grossProfit / totalSales) * 100 * 100) / 100
        : 0;

    let totalInventoryValue = 0;
    let totalInventoryUnits = 0;
    for (const val of valuations) {
      totalInventoryValue += Number(val.totalCost ?? 0);
      totalInventoryUnits += Number(val.totalQuantity ?? 0);
    }

    // 5. Build 12-Month Financial Trend
    const monthlyTrend: MonthlyTrendItem[] = monthDefinitions.map((def) => {
      let monthlyRevenue = 0;
      let monthlyCogs = 0;
      let monthlyPurchases = 0;

      for (const sale of postedSales) {
        if (!sale.saleDate) continue;
        const d = new Date(sale.saleDate);
        if (
          d.getUTCFullYear() === def.year &&
          d.getUTCMonth() === def.monthIndex
        ) {
          monthlyRevenue += Number(sale.totalAmount ?? 0);
          for (const item of sale.items) {
            for (const cogs of item.cogsEntries) {
              monthlyCogs += Number(cogs.totalCost ?? 0);
            }
          }
        }
      }

      for (const p of postedPurchases) {
        if (!p.purchaseDate) continue;
        const d = new Date(p.purchaseDate);
        if (
          d.getUTCFullYear() === def.year &&
          d.getUTCMonth() === def.monthIndex
        ) {
          monthlyPurchases += Number(p.totalAmount ?? 0);
        }
      }

      const mGrossProfit =
        Math.round((monthlyRevenue - monthlyCogs) * 100) / 100;

      return {
        month: def.label,
        shortMonth: def.shortLabel,
        year: def.year,
        monthIndex: def.monthIndex,
        revenue: Math.round(monthlyRevenue * 100) / 100,
        purchases: Math.round(monthlyPurchases * 100) / 100,
        cogs: Math.round(monthlyCogs * 100) / 100,
        grossProfit: mGrossProfit,
      };
    });

    // 6. Top Variants Ranking
    const topVariants: TopVariantItem[] = Array.from(
      variantSalesMap.values(),
    )
      .map((item) => {
        const itemGrossProfit =
          Math.round((item.revenue - item.cogs) * 100) / 100;
        const itemMargin =
          item.revenue > 0
            ? Math.round((itemGrossProfit / item.revenue) * 100 * 100) / 100
            : 0;
        return {
          ...item,
          revenue: Math.round(item.revenue * 100) / 100,
          cogs: Math.round(item.cogs * 100) / 100,
          grossProfit: itemGrossProfit,
          profitMargin: itemMargin,
        };
      })
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue)
      .slice(0, 5);

    return {
      fiscalYear,
      startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
      endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
      kpis: {
        totalSales: Math.round(totalSales * 100) / 100,
        salesCount: postedSales.length,
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        purchasesCount: postedPurchases.length,
        totalCogs: Math.round(totalCogs * 100) / 100,
        grossProfit,
        profitMargin,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        totalInventoryUnits: Math.round(totalInventoryUnits * 100) / 100,
        productsCount,
        variantsCount,
      },
      monthlyTrend,
      topVariants,
    };
  }

  /**
   * Resolves the selected Ethiopian fiscal year period or custom dates into ISO date boundaries
   * and 12-month calendar slots.
   */
  private resolveFiscalPeriod(query: QueryDashboardDto): {
    fiscalYear: string;
    startDate: Date | null;
    endDate: Date | null;
    monthDefinitions: Array<{
      label: string;
      shortLabel: string;
      year: number;
      monthIndex: number;
    }>;
  } {
    const rawFy = (query.fiscalYear || 'FY 2026 / 2027').trim();

    if (rawFy === 'ALL' || rawFy === 'All Time') {
      // Default monthly trend: last 12 calendar months ending current month
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];

      const monthDefinitions: Array<{
        label: string;
        shortLabel: string;
        year: number;
        monthIndex: number;
      }> = [];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(currentYear, currentMonth - i, 1));
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        monthDefinitions.push({
          label: `${monthNames[m]} ${y}`,
          shortLabel: monthNames[m],
          year: y,
          monthIndex: m,
        });
      }

      return {
        fiscalYear: 'All Time',
        startDate: null,
        endDate: null,
        monthDefinitions,
      };
    }

    let startYear = 2026;
    let endYear = 2027;

    if (rawFy.includes('2025') && rawFy.includes('2026')) {
      startYear = 2025;
      endYear = 2026;
    } else if (rawFy.includes('2024') && rawFy.includes('2025')) {
      startYear = 2024;
      endYear = 2025;
    } else {
      startYear = 2026;
      endYear = 2027;
    }

    const startDate = query.startDate
      ? new Date(`${query.startDate}T00:00:00.000Z`)
      : new Date(Date.UTC(startYear, 6, 1, 0, 0, 0, 0)); // July 1

    const endDate = query.endDate
      ? new Date(`${query.endDate}T23:59:59.999Z`)
      : new Date(Date.UTC(endYear, 5, 30, 23, 59, 59, 999)); // June 30

    // Ethiopian Fiscal Year runs from Jul of startYear to Jun of endYear
    const monthSequence = [
      { month: 6, year: startYear, label: `Jul ${startYear}`, shortLabel: 'Jul' },
      { month: 7, year: startYear, label: `Aug ${startYear}`, shortLabel: 'Aug' },
      { month: 8, year: startYear, label: `Sep ${startYear}`, shortLabel: 'Sep' },
      { month: 9, year: startYear, label: `Oct ${startYear}`, shortLabel: 'Oct' },
      { month: 10, year: startYear, label: `Nov ${startYear}`, shortLabel: 'Nov' },
      { month: 11, year: startYear, label: `Dec ${startYear}`, shortLabel: 'Dec' },
      { month: 0, year: endYear, label: `Jan ${endYear}`, shortLabel: 'Jan' },
      { month: 1, year: endYear, label: `Feb ${endYear}`, shortLabel: 'Feb' },
      { month: 2, year: endYear, label: `Mar ${endYear}`, shortLabel: 'Mar' },
      { month: 3, year: endYear, label: `Apr ${endYear}`, shortLabel: 'Apr' },
      { month: 4, year: endYear, label: `May ${endYear}`, shortLabel: 'May' },
      { month: 5, year: endYear, label: `Jun ${endYear}`, shortLabel: 'Jun' },
    ];

    const monthDefinitions = monthSequence.map((m) => ({
      label: m.label,
      shortLabel: m.shortLabel,
      year: m.year,
      monthIndex: m.month,
    }));

    return {
      fiscalYear: `FY ${startYear} / ${endYear}`,
      startDate,
      endDate,
      monthDefinitions,
    };
  }
}
