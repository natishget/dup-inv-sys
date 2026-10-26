'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/app-layout';
import { api } from '@/lib/api';
import {
  Sale,
  PaginatedSalesResponse,
  SaleLineItemForm,
  CreateSaleForm,
  EditSaleMetadataForm,
  VoidSaleForm,
  CreateSaleReturnForm,
  SalesDocumentData,
} from '@/types/sales';
import { Warehouse, WarehouseListResponse, WarehouseStockItem } from '@/types/warehouses';
import { PaginatedVariantsResponse, ProductVariant } from '@/types/products';
import { SalesDocumentViewer } from '@/components/sales-document-viewer';
import {
  PlusIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  EditIcon,
  XIcon,
  Trash2Icon,
  SearchIcon,
} from '@/components/icons';

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────
function BanIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" />
    </svg>
  );
}

function RotateCcwIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

// ─── Number & Date Formatters ────────────────────────────────────────────────
const fmt = (n: string | number | null | undefined) => {
  if (n === null || n === undefined || n === '') return '0.00';
  const num = typeof n === 'number' ? n : parseFloat(n);
  return isNaN(num) ? '0.00' : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateOnly = (dStr: string | null | undefined) => {
  if (!dStr) return '-';
  try {
    const d = new Date(dStr);
    return d.toISOString().slice(0, 10);
  } catch {
    return dStr;
  }
};

const formatDisplayDate = (dStr: string | null | undefined) => {
  if (!dStr) return '-';
  try {
    const d = new Date(dStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dStr;
  }
};

const emptyCreateForm = (defaultWhId: string = ''): CreateSaleForm => ({
  customerName: '',
  saleDate: '',
  warehouseId: defaultWhId,
  notes: '',
  items: [{ variantId: '', quantity: '1', sellingPrice: '' }],
});

export default function SalesPage() {
  const { user } = useAuth();
  const canMutate = user?.role === 'ADMIN' || user?.role === 'SALES';

  // ─── List State ─────────────────────────────────────────────────────────────
  const [sales, setSales] = useState<Sale[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ─── Filter State ───────────────────────────────────────────────────────────
  const [searchCustomer, setSearchCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterOrder, setFilterOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Pending filter inputs
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');
  const [pendingDate, setPendingDate] = useState('');
  const [pendingOrder, setPendingOrder] = useState<'asc' | 'desc'>('desc');

  // ─── UI Alerts / Messages ───────────────────────────────────────────────────
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Catalogs ───────────────────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [allVariants, setAllVariants] = useState<ProductVariant[]>([]);
  const [warehouseStockMap, setWarehouseStockMap] = useState<Record<string, number>>({});

  // ─── Modals State ───────────────────────────────────────────────────────────
  const [isMakeSaleOpen, setIsMakeSaleOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSaleForm>(emptyCreateForm());

  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState<EditSaleMetadataForm>({ customerName: '', notes: '' });

  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidForm, setVoidForm] = useState<VoidSaleForm>({ reason: '', voidDate: '' });

  const [returningSale, setReturningSale] = useState<Sale | null>(null);
  const [returnForm, setReturnForm] = useState<CreateSaleReturnForm>({
    warehouseId: '',
    returnDate: '',
    notes: '',
    items: [{ variantId: '', quantity: '1' }],
  });

  // Set today date on client mount
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setCreateForm((prev) => ({ ...prev, saleDate: prev.saleDate || today }));
    setVoidForm((prev) => ({ ...prev, voidDate: prev.voidDate || today }));
    setReturnForm((prev) => ({ ...prev, returnDate: prev.returnDate || today }));
  }, []);

  // ─── Document Viewer State (Quotation / Invoice) ─────────────────────────────
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [documentData, setDocumentData] = useState<SalesDocumentData | null>(null);

  // ─── 1. Fetch Warehouses and Variants ───────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadCatalogs() {
      try {
        const [whRes, varRes] = await Promise.all([
          api.get<WarehouseListResponse>('/warehouses'),
          api.get<PaginatedVariantsResponse>('/products/variants?limit=100'),
        ]);

        if (isMounted) {
          const whs = whRes.data || [];
          setWarehouses(whs);
          setAllVariants(varRes.data || []);

          if (whs.length > 0) {
            setCreateForm((prev) => ({
              ...prev,
              warehouseId: prev.warehouseId || whs[0].id,
            }));
          }
        }
      } catch (err: unknown) {
        console.error('Failed to load initial catalogs:', err);
      }
    }

    loadCatalogs();
    return () => {
      isMounted = false;
    };
  }, []);

  // ─── 2. Fetch Live Stock when warehouse changes ─────────────────────────────
  const loadWarehouseStock = useCallback(async (warehouseId: string) => {
    if (!warehouseId) {
      setWarehouseStockMap({});
      return;
    }
    try {
      const res = await api.get<{ data: WarehouseStockItem[] }>(`/warehouses/${warehouseId}/stock`);
      const map: Record<string, number> = {};
      for (const item of res.data || []) {
        map[item.variant_id] = item.total_stock;
      }
      setWarehouseStockMap(map);
    } catch (err) {
      console.error('Failed to load warehouse stock:', err);
      setWarehouseStockMap({});
    }
  }, []);

  useEffect(() => {
    if (createForm.warehouseId) {
      loadWarehouseStock(createForm.warehouseId);
    }
  }, [createForm.warehouseId, loadWarehouseStock]);

  // ─── 3. Fetch Sales List ───────────────────────────────────────────────────
  const fetchSales = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      params.set('order', filterOrder);

      if (searchCustomer.trim()) params.set('q', searchCustomer.trim());
      if (filterStatus) params.set('status', filterStatus);
      if (filterDate.trim()) params.set('date', filterDate.trim());

      const res = await api.get<PaginatedSalesResponse>(`/sales?${params.toString()}`);
      setSales(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch sales.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, filterOrder, searchCustomer, filterStatus, filterDate]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales, refreshTrigger]);

  // Filter Bar Handlers
  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchCustomer(pendingSearch);
    setFilterStatus(pendingStatus);
    setFilterDate(pendingDate);
    setFilterOrder(pendingOrder);
    setPage(1);
  };

  const handleResetFilters = () => {
    setPendingSearch('');
    setPendingStatus('');
    setPendingDate('');
    setPendingOrder('desc');

    setSearchCustomer('');
    setFilterStatus('');
    setFilterDate('');
    setFilterOrder('desc');
    setPage(1);
  };

  // ─── Format Variant Display Option ──────────────────────────────────────────
  const variantDisplayMap = useMemo(() => {
    const map = new Map<string, { label: string; variant: ProductVariant }>();
    for (const v of allVariants) {
      const parts = [
        v.product?.name || 'Product',
        v.sku ? v.sku : null,
        v.color ? v.color : null,
        v.origin ? v.origin : null,
        v.size ? v.size : null,
      ].filter(Boolean);

      map.set(v.id, {
        label: parts.join(' · '),
        variant: v,
      });
    }
    return map;
  }, [allVariants]);

  const handleOpenMakeSale = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const defaultWh = warehouses[0]?.id || '';
    const today = new Date().toISOString().slice(0, 10);
    setCreateForm({
      ...emptyCreateForm(defaultWh),
      saleDate: today,
    });
    if (defaultWh) loadWarehouseStock(defaultWh);
    setIsMakeSaleOpen(true);
  };

  const handleAddSaleRow = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, { variantId: '', quantity: '1', sellingPrice: '' }],
    }));
  };

  const handleRemoveSaleRow = (index: number) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSaleRowChange = (
    index: number,
    field: keyof SaleLineItemForm,
    value: string,
  ) => {
    setCreateForm((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  // ─── Generate Quotation from Make Sale Modal (Proforma) ────────────────────
  const handleGenerateQuotation = () => {
    if (!createForm.customerName.trim()) {
      setErrorMessage('Please enter Customer Name to generate a quotation.');
      return;
    }

    const validItems = createForm.items.filter(
      (item) => item.variantId && Number(item.quantity) > 0,
    );

    if (validItems.length === 0) {
      setErrorMessage('Please add at least one valid line item with quantity.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const dateStr = formatDisplayDate(createForm.saleDate || today);
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const ymd = (createForm.saleDate || today).replace(/-/g, '');
    const docNo = `Q-${ymd}-${randomSuffix}`;

    const items = validItems.map((item) => {
      const vInfo = variantDisplayMap.get(item.variantId)?.variant;
      const qty = Number(item.quantity) || 1;
      const price = Number(item.sellingPrice) || 0;
      return {
        name: vInfo?.product?.name || 'Item',
        sku: vInfo?.sku || null,
        color: vInfo?.color || null,
        origin: vInfo?.origin || null,
        size: vInfo?.size || null,
        thickness: vInfo?.thickness || null,
        quantity: qty,
        unitPrice: price,
        total: qty * price,
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const taxRate = 0.15;
    const taxAmount = subtotal * taxRate;
    const grandTotal = subtotal + taxAmount;

    setDocumentData({
      type: 'QUOTATION',
      documentNo: docNo,
      subtitle: 'Proforma Invoice',
      date: dateStr,
      customerName: createForm.customerName.trim(),
      notes: createForm.notes?.trim() || undefined,
      items,
      subtotal,
      taxRate,
      taxAmount,
      grandTotal,
    });

    setDocumentViewerOpen(true);
  };

  // ─── Save Sale (Submit to Backend) ──────────────────────────────────────────
  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!createForm.customerName.trim()) {
      setErrorMessage('Customer name is required.');
      return;
    }

    if (!createForm.warehouseId) {
      setErrorMessage('Please select a fulfillment warehouse.');
      return;
    }

    const validItems = createForm.items.filter((i) => i.variantId.trim());
    if (validItems.length === 0) {
      setErrorMessage('At least one item line must be added.');
      return;
    }

    for (let idx = 0; idx < validItems.length; idx++) {
      const it = validItems[idx];
      const q = Number(it.quantity);
      const p = Number(it.sellingPrice);
      const vLabel = variantDisplayMap.get(it.variantId)?.label || `Row ${idx + 1}`;

      if (isNaN(q) || q <= 0) {
        setErrorMessage(`Invalid quantity for ${vLabel}. Must be greater than 0.`);
        return;
      }
      if (isNaN(p) || p < 0) {
        setErrorMessage(`Invalid selling price for ${vLabel}. Cannot be negative.`);
        return;
      }

      // Check available stock
      const stock = warehouseStockMap[it.variantId] || 0;
      if (q > stock) {
        setErrorMessage(
          `Insufficient stock for "${vLabel}". In stock: ${stock}, requested: ${q}.`,
        );
        return;
      }
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        customerName: createForm.customerName.trim(),
        saleDate: createForm.saleDate || today,
        warehouseId: createForm.warehouseId,
        notes: createForm.notes?.trim() || undefined,
        items: validItems.map((i) => ({
          variantId: i.variantId,
          quantity: Number(i.quantity),
          sellingPrice: Number(i.sellingPrice) || 0,
        })),
      };

      await api.post('/sales', payload);
      setSuccessMessage('Sale created successfully and inventory FIFO layers depleted.');
      setIsMakeSaleOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save sale.';
      setErrorMessage(msg);
    }
  };

  // ─── 5. View Invoice Document ───────────────────────────────────────────────
  const handleViewInvoice = (sale: Sale) => {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = formatDisplayDate(sale.saleDate || sale.createdAt);
    const ymd = (formatDateOnly(sale.saleDate) || today).replace(/-/g, '');
    const shortId = sale.id.slice(-6).toUpperCase();
    const docNo = `INV-${ymd}-${shortId}`;

    const items = sale.items.map((it) => {
      const v = it.variant;
      const qty = Number(it.quantity) || 1;
      const price = Number(it.sellingPrice) || 0;
      const total = Number(it.totalPrice) || qty * price;

      return {
        name: v?.product?.name || 'Item',
        sku: v?.sku || null,
        color: v?.color || null,
        origin: v?.origin || null,
        size: v?.size || null,
        thickness: v?.thickness || null,
        quantity: qty,
        unitPrice: price,
        total,
      };
    });

    const subtotal = Number(sale.totalAmount) || items.reduce((s, i) => s + i.total, 0);
    const taxRate = 0.15;
    const taxAmount = subtotal * taxRate;
    const grandTotal = subtotal + taxAmount;

    setDocumentData({
      type: 'INVOICE',
      documentNo: docNo,
      subtitle: 'Sales Invoice',
      date: dateStr,
      customerName: sale.customerName || 'Customer',
      notes: sale.notes || undefined,
      items,
      subtotal,
      taxRate,
      taxAmount,
      grandTotal,
    });

    setDocumentViewerOpen(true);
  };

  // ─── 6. Edit Metadata Handlers ──────────────────────────────────────────────
  const handleOpenEdit = (sale: Sale) => {
    setEditingSale(sale);
    setEditForm({
      customerName: sale.customerName || '',
      notes: sale.notes || '',
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    try {
      await api.patch(`/sales/${editingSale.id}`, {
        customerName: editForm.customerName.trim(),
        notes: editForm.notes.trim() || undefined,
      });

      setSuccessMessage('Sale metadata updated successfully.');
      setEditingSale(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update metadata.';
      setErrorMessage(msg);
    }
  };

  // ─── 7. Void Sale Handlers ──────────────────────────────────────────────────
  const handleOpenVoid = (sale: Sale) => {
    const today = new Date().toISOString().slice(0, 10);
    setVoidingSale(sale);
    setVoidForm({ reason: '', voidDate: today });
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidingSale) return;

    if (!voidForm.reason.trim()) {
      setErrorMessage('Please provide an audit reason for voiding this sale.');
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.post(`/sales/${voidingSale.id}/void`, {
        reason: voidForm.reason.trim(),
        voidDate: voidForm.voidDate || today,
      });

      setSuccessMessage('Sale voided successfully. Inventory returned to warehouse.');
      setVoidingSale(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to void sale.';
      setErrorMessage(msg);
    }
  };

  // ─── 8. Return Sale Handlers ────────────────────────────────────────────────
  const handleOpenReturn = (sale: Sale) => {
    const today = new Date().toISOString().slice(0, 10);
    setReturningSale(sale);
    const defaultWh = warehouses[0]?.id || '';
    const initialItem = sale.items[0]?.variantId
      ? [{ variantId: sale.items[0].variantId, quantity: '1' }]
      : [{ variantId: '', quantity: '1' }];

    setReturnForm({
      warehouseId: defaultWh,
      returnDate: today,
      notes: '',
      items: initialItem,
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningSale) return;

    if (!returnForm.warehouseId) {
      setErrorMessage('Please select a receiving warehouse for the return.');
      return;
    }

    const validItems = returnForm.items.filter((i) => i.variantId && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please specify at least one item and quantity to return.');
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.post(`/sales/${returningSale.id}/returns`, {
        warehouseId: returnForm.warehouseId,
        returnDate: returnForm.returnDate || today,
        notes: returnForm.notes.trim() || undefined,
        items: validItems.map((i) => ({
          variantId: i.variantId,
          quantity: Number(i.quantity),
        })),
      });

      setSuccessMessage('Customer return processed successfully. Stock restocked.');
      setReturningSale(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process return.';
      setErrorMessage(msg);
    }
  };

  return (
    <AppLayout breadcrumb="Sales">
      <div className="space-y-6">
        {/* Alerts */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
            <AlertCircleIcon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-300 cursor-pointer"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-3 p-4 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircleIcon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Sales</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Create sales with multiple items and consume inventory FIFO layers.
            </p>
          </div>

          {canMutate && (
            <button
              onClick={handleOpenMakeSale}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Make Sale
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <form
          onSubmit={handleApplyFilters}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl"
        >
          {/* Search Customer */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Search Customer
            </label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search customer"
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Status
            </label>
            <select
              value={pendingStatus}
              onChange={(e) => setPendingStatus(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
            >
              <option value="">All statuses</option>
              <option value="POSTED">POSTED</option>
              <option value="VOIDED">VOIDED</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          {/* Date Order */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Date Order
            </label>
            <select
              value={pendingOrder}
              onChange={(e) => setPendingOrder(e.target.value as 'asc' | 'desc')}
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="flex-1 py-1.5 px-3 bg-zinc-200 hover:bg-white text-zinc-950 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="py-1.5 px-3 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium text-xs rounded-lg transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Sales Table */}
        <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800/80 text-zinc-400 text-[11px] uppercase tracking-wider bg-zinc-900/40">
                  <th className="py-3.5 px-4 font-semibold">Customer</th>
                  <th className="py-3.5 px-4 font-semibold">Date</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Items</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Total</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-500">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCwIcon className="w-4 h-4 animate-spin" />
                        <span>Loading sales...</span>
                      </div>
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-zinc-500">
                      No sales yet
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => {
                    const isVoided = sale.status === 'VOIDED';

                    return (
                      <tr key={sale.id} className="hover:bg-zinc-900/30 transition-colors">
                        {/* Customer */}
                        <td className="py-4 px-4 font-medium text-zinc-100 whitespace-nowrap">
                          {sale.customerName || 'Walk-in Customer'}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-4 text-zinc-400 whitespace-nowrap">
                          {formatDateOnly(sale.saleDate)}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                              isVoided
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
                            }`}
                          >
                            {sale.status}
                          </span>
                        </td>

                        {/* Items */}
                        <td className="py-4 px-4 max-w-xs">
                          <div className="font-medium text-zinc-200">
                            {sale.items.length} items
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate mt-0.5" title={sale.items.map(it => {
                            const pName = it.variant?.product?.name || 'Item';
                            const sku = it.variant?.sku || '';
                            const col = it.variant?.color || '';
                            const orig = it.variant?.origin || '';
                            return `${pName} · ${sku} · ${col} · ${orig} | Qty: ${it.quantity} | Sp: ${it.sellingPrice}`;
                          }).join(', ')}>
                            {sale.items.map((it, idx) => {
                              const pName = it.variant?.product?.name || 'Item';
                              const sku = it.variant?.sku || '';
                              const col = it.variant?.color || '';
                              const orig = it.variant?.origin || '';
                              return (
                                <span key={idx}>
                                  {pName} · {sku} · {col} · {orig} | Qty: {Number(it.quantity).toFixed(4)} | Sp: {Number(it.sellingPrice).toFixed(4)}
                                  {idx < sale.items.length - 1 ? '; ' : ''}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Total */}
                        <td className="py-4 px-4 text-right font-medium text-zinc-100 whitespace-nowrap">
                          {fmt(sale.totalAmount)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Invoice Document Viewer */}
                            <button
                              onClick={() => handleViewInvoice(sale)}
                              title="View Invoice"
                              className="px-2 py-1 text-[11px] font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <FileTextIcon className="w-3 h-3 text-zinc-400" />
                              Invoice
                            </button>

                            {canMutate && !isVoided && (
                              <>
                                {/* Edit */}
                                <button
                                  onClick={() => handleOpenEdit(sale)}
                                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors cursor-pointer"
                                >
                                  Edit
                                </button>

                                {/* Return */}
                                <button
                                  onClick={() => handleOpenReturn(sale)}
                                  className="px-2.5 py-1 text-[11px] font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors cursor-pointer"
                                >
                                  Return
                                </button>

                                {/* Void */}
                                <button
                                  onClick={() => handleOpenVoid(sale)}
                                  className="px-2.5 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors cursor-pointer"
                                >
                                  Void
                                </button>
                              </>
                            )}

                            {isVoided && (
                              <span className="text-[11px] text-zinc-600 italic px-2">
                                Voided
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/80 bg-zinc-900/20 text-xs text-zinc-400">
            <div>
              Showing {sales.length > 0 ? (meta.page - 1) * 10 + 1 : 0}-
              {Math.min(meta.page * 10, meta.total)} of {meta.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAKE SALE MODAL ─────────────────────────────────────────────────── */}
      {isMakeSaleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100 my-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-zinc-800/80">
              <div>
                <h2 className="text-base font-bold text-zinc-100">Make Sale</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Add one or more items to record a sale.
                </p>
              </div>
              <button
                onClick={() => setIsMakeSaleOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-4 mt-4">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Adebe Kebede"
                  value={createForm.customerName}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, customerName: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. This is a Test Note"
                  value={createForm.notes}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Two-column Row: Sale Date & Warehouse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Sale Date
                  </label>
                  <input
                    type="date"
                    value={createForm.saleDate}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, saleDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Warehouse
                  </label>
                  <select
                    value={createForm.warehouseId}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, warehouseId: e.target.value }))
                    }
                    required
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name || 'Warehouse'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sale Items Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
                  <span className="text-xs font-bold text-zinc-200">Sale Items</span>
                  <button
                    type="button"
                    onClick={handleAddSaleRow}
                    className="text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    + Add Row
                  </button>
                </div>

                <div className="space-y-3 mt-3 max-h-60 overflow-y-auto pr-1">
                  {createForm.items.map((row, idx) => {
                    const availStock = row.variantId
                      ? warehouseStockMap[row.variantId] || 0
                      : null;

                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl"
                      >
                        {/* Variant Dropdown */}
                        <div className="flex-1 w-full">
                          <label className="block text-[10px] text-zinc-500 mb-1">
                            Variant
                          </label>
                          <select
                            value={row.variantId}
                            onChange={(e) =>
                              handleSaleRowChange(idx, 'variantId', e.target.value)
                            }
                            required
                            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                          >
                            <option value="">Select product variant...</option>
                            {allVariants.map((v) => {
                              const label = variantDisplayMap.get(v.id)?.label || v.id;
                              return (
                                <option key={v.id} value={v.id}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>

                          {/* Live Available Stock Badge */}
                          {row.variantId && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span
                                className={`text-[11px] font-medium ${
                                  (availStock || 0) > 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                Available: {availStock !== null ? availStock : 0}
                              </span>
                              {availStock === 0 && (
                                <span className="text-[10px] text-rose-500 font-medium">
                                  (Out of stock)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="w-full sm:w-24">
                          <label className="block text-[10px] text-zinc-500 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={row.quantity}
                            onChange={(e) =>
                              handleSaleRowChange(idx, 'quantity', e.target.value)
                            }
                            required
                            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                          />
                        </div>

                        {/* Selling Price */}
                        <div className="w-full sm:w-32">
                          <label className="block text-[10px] text-zinc-500 mb-1">
                            Selling Price
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={row.sellingPrice}
                            onChange={(e) =>
                              handleSaleRowChange(idx, 'sellingPrice', e.target.value)
                            }
                            required
                            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
                          />
                        </div>

                        {/* Delete Row Button */}
                        {createForm.items.length > 1 && (
                          <div className="pt-4 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveSaleRow(idx)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2Icon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMakeSaleOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleGenerateQuotation}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <FileTextIcon className="w-3.5 h-3.5 text-zinc-400" />
                  Generate Quotation
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Save Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT SALE METADATA MODAL ────────────────────────────────────────── */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100">
            <div className="flex items-start justify-between pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-base font-bold text-zinc-100">Edit Sale Metadata</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Update customer remarks without altering financial lines.
                </p>
              </div>
              <button
                onClick={() => setEditingSale(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={editForm.customerName}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, customerName: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── VOID SALE MODAL ─────────────────────────────────────────────────── */}
      {voidingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#0c0c0e] border border-rose-900/40 rounded-2xl shadow-2xl p-6 text-zinc-100">
            <div className="flex items-start justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <BanIcon className="w-5 h-5 text-rose-500 shrink-0" />
                <h2 className="text-base font-bold text-zinc-100">Void Sale Order</h2>
              </div>
              <button
                onClick={() => setVoidingSale(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs leading-relaxed">
              <strong>Warning:</strong> Voiding will reverse all inventory movements (+quantity SALE_RETURN) and restore consumed FIFO cost layers. This action is irreversible.
            </div>

            <form onSubmit={handleConfirmVoid} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Audit Justification Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Client cancelled order prior to site delivery"
                  value={voidForm.reason}
                  onChange={(e) =>
                    setVoidForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  required
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Void Effective Date
                </label>
                <input
                  type="date"
                  value={voidForm.voidDate}
                  onChange={(e) =>
                    setVoidForm((prev) => ({ ...prev, voidDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVoidingSale(null)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── RETURN SALE MODAL ───────────────────────────────────────────────── */}
      {returningSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl p-6 text-zinc-100">
            <div className="flex items-start justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <RotateCcwIcon className="w-5 h-5 text-zinc-300 shrink-0" />
                <h2 className="text-base font-bold text-zinc-100">Process Customer Return</h2>
              </div>
              <button
                onClick={() => setReturningSale(null)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReturn} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Receiving Warehouse
                  </label>
                  <select
                    value={returnForm.warehouseId}
                    onChange={(e) =>
                      setReturnForm((prev) => ({ ...prev, warehouseId: e.target.value }))
                    }
                    required
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name || 'Warehouse'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Return Date
                  </label>
                  <input
                    type="date"
                    value={returnForm.returnDate}
                    onChange={(e) =>
                      setReturnForm((prev) => ({ ...prev, returnDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              {/* Items in this sale available to return */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Item to Return
                </label>
                <select
                  value={returnForm.items[0]?.variantId || ''}
                  onChange={(e) =>
                    setReturnForm((prev) => ({
                      ...prev,
                      items: [{ ...prev.items[0], variantId: e.target.value }],
                    }))
                  }
                  required
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                >
                  <option value="">Select line item...</option>
                  {returningSale.items.map((it) => {
                    const label =
                      variantDisplayMap.get(it.variantId || '')?.label ||
                      it.variant?.product?.name ||
                      'Item';
                    return (
                      <option key={it.id} value={it.variantId || ''}>
                        {label} (Original Sold: {it.quantity})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Return Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={returnForm.items[0]?.quantity || '1'}
                  onChange={(e) =>
                    setReturnForm((prev) => ({
                      ...prev,
                      items: [{ ...prev.items[0], quantity: e.target.value }],
                    }))
                  }
                  required
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Return Reason / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Surface scratch, site specification adjustment"
                  value={returnForm.notes}
                  onChange={(e) =>
                    setReturnForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturningSale(null)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg cursor-pointer"
                >
                  Process Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── SALES DOCUMENT VIEWER (QUOTATION & INVOICE) ────────────────────── */}
      <SalesDocumentViewer
        isOpen={documentViewerOpen}
        onClose={() => setDocumentViewerOpen(false)}
        data={documentData}
      />
    </AppLayout>
  );
}
