export interface Warehouse {
  id: string;
  name: string | null;
  location: string | null;
}

export interface WarehouseStockItem {
  variant_id: string;
  product_name: string;
  sku: string | null;
  color: string | null;
  origin: 'LOCAL' | 'IMPORTED' | null;
  thickness: string | null;
  size: string | null;
  total_stock: number;
}

export interface WarehouseListResponse {
  data: Warehouse[];
}

export interface WarehouseCreateResponse {
  data: Warehouse;
  message: string;
}
