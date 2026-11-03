import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';
import { QueryFinancialsDto } from './dto/query-financials.dto';
import { QueryTopProductsDto } from './dto/query-top-products.dto';

export interface FinancialsMonthItem {
  month: string;
  label: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
}

export interface FinancialsTotals {
  revenue: number;
  cogs: number;
  gross_profit: number;
}

export interface DashboardFinancialsResponse {
  fiscal_year: number;
  start_date: string;
  end_date: string;
  months: FinancialsMonthItem[];
  totals: FinancialsTotals;
}

export interface TopProductItem {
  variant_id: string;
  product_name: string;
  color: string;
  origin: string;
  label: string;
  total_quantity: number;
  revenue: number;
}

export interface DashboardTopProductsResponse {
  fiscal_year: number;
  start_date: string;
  end_date: string;
  limit: number;
  data: TopProductItem[];
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// 5-minute TTL (300,000 milliseconds) as specified in Documentation/04-api-reference/02-dashboard-and-analytics-api.md
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

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
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clears in-memory dashboard cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCached<T>(key: string, data: T, ttlMs = DASHBOARD_CACHE_TTL_MS): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Calculates the active corporate fiscal year according to Ethiopian / July 1 - June 30 cycle.
   */
  public getCurrentFiscalYear(): number {
    const today = new Date();
    // July is 0-indexed month 6
    return today.getUTCMonth() >= 6 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  }

  /**
   * Resolves the UTC start and end Date objects for a given corporate fiscal year (July 1 to June 30).
   */
  public getFiscalYearBoundaries(year: number): { startDate: Date; endDate: Date } {
    const startDate = new Date(Date.UTC(year, 6, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year + 1, 5, 30, 23, 59, 59, 999));
    return { startDate, endDate };
  }

  /**
   * GET /dashboard/financials
   * Returns annual corporate financial totals and a 12-month calendar breakdown
   * for a specified corporate fiscal year (July 1 to June 30).
   * Cached in memory for 5 minutes.
   */
  async getFinancials(query: QueryFinancialsDto): Promise<DashboardFinancialsResponse> {
    const fiscalYear = query.fiscal_year ?? this.getCurrentFiscalYear();
    const cacheKey = `dashboard.financials.${fiscalYear}`;

    const cached = this.getCached<DashboardFinancialsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const { startDate, endDate } = this.getFiscalYearBoundaries(fiscalYear);

    // Query posted sales with items and COGS entries for accurate revenue and COGS aggregation
    const postedSales = await this.prisma.sale.findMany({
      where: {
        status: TransactionStatus.POSTED,
        saleDate: { gte: startDate, lte: endDate },
      },
      include: {
        items: {
          include: {
            cogsEntries: true,
          },
        },
      },
      orderBy: { saleDate: 'asc' },
    });

    const monthSequence = [
      { year: fiscalYear, monthIndex: 6, label: `Jul ${fiscalYear}`, monthStr: `${fiscalYear}-07` },
      { year: fiscalYear, monthIndex: 7, label: `Aug ${fiscalYear}`, monthStr: `${fiscalYear}-08` },
      { year: fiscalYear, monthIndex: 8, label: `Sep ${fiscalYear}`, monthStr: `${fiscalYear}-09` },
      { year: fiscalYear, monthIndex: 9, label: `Oct ${fiscalYear}`, monthStr: `${fiscalYear}-10` },
      { year: fiscalYear, monthIndex: 10, label: `Nov ${fiscalYear}`, monthStr: `${fiscalYear}-11` },
      { year: fiscalYear, monthIndex: 11, label: `Dec ${fiscalYear}`, monthStr: `${fiscalYear}-12` },
      { year: fiscalYear + 1, monthIndex: 0, label: `Jan ${fiscalYear + 1}`, monthStr: `${fiscalYear + 1}-01` },
      { year: fiscalYear + 1, monthIndex: 1, label: `Feb ${fiscalYear + 1}`, monthStr: `${fiscalYear + 1}-02` },
      { year: fiscalYear + 1, monthIndex: 2, label: `Mar ${fiscalYear + 1}`, monthStr: `${fiscalYear + 1}-03` },
      { year: fiscalYear + 1, monthIndex: 3, label: `Apr ${fiscalYear + 1}`, monthStr: `${fiscalYear + 1}-04` },
      { year: fiscalYear + 1, monthIndex: 4, label: `May ${fiscalYear + 1}`, monthStr: `${fiscalYear + 1}-05` },
      { year: fiscalYear + 1, monthIndex: 5, label: `Jun ${fiscalYear + 1}`, monthStr: `${fiscalYear + 1}-06` },
    ];

    let totalRevenue = 0;
    let totalCogs = 0;

    const months: FinancialsMonthItem[] = monthSequence.map((seq) => {
      let monthlyRevenue = 0;
      let monthlyCogs = 0;

      for (const sale of postedSales) {
        if (!sale.saleDate) continue;
        const d = new Date(sale.saleDate);
        if (
          d.getUTCFullYear() === seq.year &&
          d.getUTCMonth() === seq.monthIndex
        ) {
          monthlyRevenue += Number(sale.totalAmount ?? 0);
          for (const item of sale.items) {
            for (const cogs of item.cogsEntries) {
              monthlyCogs += Number(cogs.totalCost ?? 0);
            }
          }
        }
      }

      const roundedRevenue = Math.round(monthlyRevenue * 100) / 100;
      const roundedCogs = Math.round(monthlyCogs * 100) / 100;
      const roundedGrossProfit = Math.round((roundedRevenue - roundedCogs) * 100) / 100;

      totalRevenue += roundedRevenue;
      totalCogs += roundedCogs;

      return {
        month: seq.monthStr,
        label: seq.label,
        revenue: roundedRevenue,
        cogs: roundedCogs,
        gross_profit: roundedGrossProfit,
      };
    });

    const totals: FinancialsTotals = {
      revenue: Math.round(totalRevenue * 100) / 100,
      cogs: Math.round(totalCogs * 100) / 100,
      gross_profit: Math.round((totalRevenue - totalCogs) * 100) / 100,
    };

    const response: DashboardFinancialsResponse = {
      fiscal_year: fiscalYear,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      months,
      totals,
    };

    this.setCached(cacheKey, response);
    return response;
  }

  /**
   * GET /dashboard/top-products
   * Returns highest-volume product variants sold during a corporate fiscal year, ranked by total units dispatched.
   * Cached in memory for 5 minutes.
   */
  async getTopProducts(query: QueryTopProductsDto): Promise<DashboardTopProductsResponse> {
    const fiscalYear = query.fiscal_year ?? this.getCurrentFiscalYear();
    const limit = Math.min(Math.max(query.limit ?? 10, 1), 15);
    const cacheKey = `dashboard.top-products.${fiscalYear}.${limit}`;

    const cached = this.getCached<DashboardTopProductsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const { startDate, endDate } = this.getFiscalYearBoundaries(fiscalYear);

    // Query posted sale items for the fiscal period
    const saleItems = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          status: TransactionStatus.POSTED,
          saleDate: { gte: startDate, lte: endDate },
        },
      },
      include: {
        variant: {
          include: {
            product: true,
          },
        },
      },
    });

    const aggregateMap = new Map<
      string,
      {
        variant_id: string;
        product_name: string;
        color: string;
        origin: string;
        label: string;
        total_quantity: number;
        revenue: number;
      }
    >();

    for (const item of saleItems) {
      if (!item.variantId || !item.variant) continue;
      const v = item.variant;
      const qty = Number(item.quantity ?? 0);
      const rev = Number(item.totalPrice ?? 0);

      const existing = aggregateMap.get(item.variantId);
      if (existing) {
        existing.total_quantity += qty;
        existing.revenue += rev;
      } else {
        const productName = v.product?.name ?? 'Unknown Product';
        const color = v.color ?? 'Standard';
        const origin = v.origin ?? 'LOCAL';
        const originDisplay = origin.toUpperCase() === 'IMPORTED' ? 'Imported' : 'Local';
        const label = `${productName} - ${color} - ${originDisplay}`;

        aggregateMap.set(item.variantId, {
          variant_id: item.variantId,
          product_name: productName,
          color,
          origin,
          label,
          total_quantity: qty,
          revenue: rev,
        });
      }
    }

    const sorted = Array.from(aggregateMap.values())
      .sort((a, b) => b.total_quantity - a.total_quantity || b.revenue - a.revenue)
      .slice(0, limit)
      .map((item) => ({
        ...item,
        total_quantity: Math.round(item.total_quantity * 10000) / 10000,
        revenue: Math.round(item.revenue * 100) / 100,
      }));

    const response: DashboardTopProductsResponse = {
      fiscal_year: fiscalYear,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      limit,
      data: sorted,
    };

    this.setCached(cacheKey, response);
    return response;
  }

  async getMetrics(query: QueryDashboardDto): Promise<DashboardMetricsResponse> {
    const limit = Math.min(Math.max(query.limit ?? 12, 1), 15);
    const { fiscalYear, startDate, endDate, monthDefinitions } =
      this.resolveFiscalPeriod(query);

    const cacheKey = `dashboard.metrics.${fiscalYear}.${query.startDate || ''}.${query.endDate || ''}.${limit}`;
    const cached = this.getCached<DashboardMetricsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

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

    // 6. Top Variants Ranking (Configurable limit: default 12, max 15 per Doc 05-02 §4.1)
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
      .slice(0, limit);

    const result: DashboardMetricsResponse = {
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

    this.setCached(cacheKey, result);
    return result;
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
