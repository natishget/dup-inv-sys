export interface DashboardFinancialMonth {
  month: string;
  label: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
}

export interface DashboardFinancialsResponse {
  fiscal_year: number;
  start_date: string;
  end_date: string;
  months: DashboardFinancialMonth[];
  totals: {
    revenue: number;
    cogs: number;
    gross_profit: number;
  };
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
