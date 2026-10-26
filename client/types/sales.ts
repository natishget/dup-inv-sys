export type SaleStatus = 'POSTED' | 'VOIDED';

export interface SaleVariant {
  id: string;
  sku: string | null;
  color: string | null;
  origin: 'LOCAL' | 'IMPORTED' | null;
  thickness: string | number | null;
  size: string | null;
  product: {
    id: string;
    name: string;
    baseUnit?: string | null;
  } | null;
}

export interface CogsEntry {
  id: string;
  saleItemId: string | null;
  variantId: string | null;
  quantity: string | number | null;
  unitCost: string | number | null;
  totalCost: string | number | null;
  costingMethod: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE' | null;
  sourceLayerId: string | null;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string | null;
  variantId: string | null;
  quantity: string | number | null;
  sellingPrice: string | number | null;
  totalPrice: string | number | null;
  variant: SaleVariant | null;
  cogsEntries?: CogsEntry[];
}

export interface Sale {
  id: string;
  customerName: string | null;
  totalAmount: string | number | null;
  saleDate: string | null;
  status: SaleStatus;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  createdById: string | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: SaleItem[];
}

export interface PaginatedSalesResponse {
  data: Sale[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Form Types ─────────────────────────────────────────────────────────────

export interface SaleLineItemForm {
  variantId: string;
  quantity: string;
  sellingPrice: string;
}

export interface CreateSaleForm {
  customerName: string;
  saleDate: string;
  warehouseId: string;
  notes: string;
  items: SaleLineItemForm[];
}

export interface EditSaleMetadataForm {
  customerName: string;
  notes: string;
}

export interface VoidSaleForm {
  reason: string;
  voidDate: string;
}

export interface SaleReturnLineItemForm {
  variantId: string;
  quantity: string;
}

export interface CreateSaleReturnForm {
  warehouseId: string;
  returnDate: string;
  notes: string;
  items: SaleReturnLineItemForm[];
}

// ─── Document Viewer Types (Quotation / Invoice) ───────────────────────────

export interface DocumentItemRow {
  name: string;
  sku?: string | null;
  color?: string | null;
  origin?: string | null;
  size?: string | null;
  thickness?: string | number | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesDocumentData {
  type: 'QUOTATION' | 'INVOICE';
  documentNo: string;
  subtitle: string;
  date: string;
  customerName: string;
  notes?: string;
  items: DocumentItemRow[];
  subtotal: number;
  taxRate: number; // 0.15 for 15%
  taxAmount: number;
  grandTotal: number;
}
