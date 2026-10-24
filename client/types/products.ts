export type ProductOrigin = 'LOCAL' | 'IMPORTED';

export interface Product {
  id: string;
  name: string;
  baseUnit: string | null;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string | null;
  color: string | null;
  origin: ProductOrigin | null;
  sku: string | null;
  thickness: string | number | null;
  size: string | null;
  createdAt: string;
  product: Product | null;
}

export interface PaginatedVariantsResponse {
  data: ProductVariant[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateProductPayload {
  name: string;
  baseUnit?: string;
}

export interface CreateVariantPayload {
  productId: string;
  color?: string;
  origin?: ProductOrigin;
  sku?: string;
  thickness?: number;
  size?: string;
}

export interface UpdateVariantPayload {
  productId?: string;
  color?: string;
  origin?: ProductOrigin;
  sku?: string;
  thickness?: number;
  size?: string;
}
