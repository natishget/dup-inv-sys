export type CostingMethod = 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE';

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
  active_method: CostingMethod;
  selected_method: CostingMethod;
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
