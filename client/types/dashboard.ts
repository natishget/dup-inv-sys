export interface MonthlyTrendItem {
  month: string;
  shortMonth: string;
  year: number;
  monthIndex: number;
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
