export type PurchaseStatus = 'POSTED' | 'VOIDED';

export interface PurchaseVariant {
  id: string;
  sku: string | null;
  color: string | null;
  origin: 'LOCAL' | 'IMPORTED' | null;
  product: { name: string } | null;
}

export interface PurchaseItem {
  id: string;
  variantId: string | null;
  quantity: string | null;
  unitCost: string | null;
  totalCost: string | null;
  variant: PurchaseVariant | null;
}

export interface Purchase {
  id: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  totalAmount: string | null;
  purchaseDate: string | null;
  status: PurchaseStatus;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  createdById: string | null;
  items: PurchaseItem[];
}

export interface PaginatedPurchasesResponse {
  data: Purchase[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Form types ───────────────────────────────────────────────────────────────

export interface PurchaseLineItemForm {
  variantId: string;
  quantity: string;
  unitCost: string;
}

export interface CreatePurchaseForm {
  supplierName: string;
  invoiceNumber: string;
  purchaseDate: string;
  warehouseId: string;
  notes: string;
  items: PurchaseLineItemForm[];
}

export interface ReturnLineItemForm {
  variantId: string;
  quantity: string;
}

export interface CreateReturnForm {
  warehouseId: string;
  returnDate: string;
  notes: string;
  items: ReturnLineItemForm[];
}
