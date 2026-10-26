'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/app-layout';
import { api } from '@/lib/api';
import {
  Purchase,
  PaginatedPurchasesResponse,
  PurchaseLineItemForm,
  CreatePurchaseForm,
  ReturnLineItemForm,
  CreateReturnForm,
} from '@/types/purchases';
import { Warehouse, WarehouseListResponse } from '@/types/warehouses';
import {
  PurchasesIcon,
  PlusIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  EditIcon,
  XIcon,
  Trash2Icon,
  SearchIcon,
} from '@/components/icons';

// ─── Inline icons ─────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: string | null | undefined) =>
  n ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00';

const emptyCreateForm = (): CreatePurchaseForm => ({
  supplierName: '',
  invoiceNumber: '',
  purchaseDate: '',
  warehouseId: '',
  notes: '',
  items: [{ variantId: '', quantity: '', unitCost: '' }],
});

const emptyReturnForm = (): CreateReturnForm => ({
  warehouseId: '',
  returnDate: '',
  notes: '',
  items: [{ variantId: '', quantity: '' }],
});

// ─── Types for variant dropdown ───────────────────────────────────────────────
interface VariantOption {
  id: string;
  label: string;
  sku: string | null;
}

export default function PurchasesPage() {
  const { user } = useAuth();
  const canMutate = user?.role === 'ADMIN' || user?.role === 'SALES';

  // ── List state ─────────────────────────────────────────────────────────────
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchSupplier, setSearchSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterOrder, setFilterOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  // pending = values in inputs before Apply is clicked
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingStatus, setPendingStatus] = useState('');
  const [pendingDate, setPendingDate] = useState('');
  const [pendingOrder, setPendingOrder] = useState<'asc' | 'desc'>('desc');

  // ── Notifications ──────────────────────────────────────────────────────────
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Dropdown data ──────────────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreatePurchaseForm>(emptyCreateForm());
  const [isCreating, setIsCreating] = useState(false);

  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editSupplier, setEditSupplier] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [voidTarget, setVoidTarget] = useState<Purchase | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  const [returnTarget, setReturnTarget] = useState<Purchase | null>(null);
  const [returnForm, setReturnForm] = useState<CreateReturnForm>(emptyReturnForm());
  const [isReturning, setIsReturning] = useState(false);

  const refresh = useCallback(() => setRefreshTrigger((n) => n + 1), []);

  // ── Load dropdown data once ────────────────────────────────────────────────
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setCreateForm((prev) => ({ ...prev, purchaseDate: prev.purchaseDate || todayStr }));
    setReturnForm((prev) => ({ ...prev, returnDate: prev.returnDate || todayStr }));

    api.get<WarehouseListResponse>('/warehouses').then((r) => setWarehouses(r.data)).catch(() => {});
    api.get<{ data: { id: string; sku: string | null; color: string | null; origin: string | null; product: { name: string } | null }[] }>('/products/variants?limit=500')
      .then((r) => {
        setVariants(
          r.data.map((v) => ({
            id: v.id,
            label: [v.product?.name, v.color, v.origin, v.sku].filter(Boolean).join(' · '),
            sku: v.sku,
          })),
        );
      })
      .catch(() => {});
  }, []);

  // ── Load purchases ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '10');
    params.set('order', filterOrder);
    if (searchSupplier.trim()) params.set('q', searchSupplier.trim());
    if (filterStatus) params.set('status', filterStatus);
    if (filterDate) params.set('date', filterDate);

    api.get<PaginatedPurchasesResponse>(`/purchases?${params.toString()}`)
      .then((r) => {
        if (!cancelled) {
          setPurchases(r.data);
          setMeta({ total: r.meta.total, page: r.meta.page, totalPages: r.meta.totalPages });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setErrorMessage(e instanceof Error ? e.message : 'Failed to load purchases.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [page, searchSupplier, filterStatus, filterDate, filterOrder, refreshTrigger]);

  // ── Apply / Reset filters ──────────────────────────────────────────────────
  const handleApply = () => {
    setSearchSupplier(pendingSearch);
    setFilterStatus(pendingStatus);
    setFilterDate(pendingDate);
    setFilterOrder(pendingOrder);
    setPage(1);
  };
  const handleReset = () => {
    setPendingSearch(''); setPendingStatus(''); setPendingDate(''); setPendingOrder('desc');
    setSearchSupplier(''); setFilterStatus(''); setFilterDate(''); setFilterOrder('desc');
    setPage(1);
  };

  // ── Create purchase ────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.items.some((i) => !i.variantId || !i.quantity || !i.unitCost)) {
      setErrorMessage('All line items must have a variant, quantity, and unit cost.');
      return;
    }
    setIsCreating(true);
    setErrorMessage(null);
    try {
      const res = await api.post<{ data: Purchase; message: string }>('/purchases', {
        supplierName: createForm.supplierName || undefined,
        invoiceNumber: createForm.invoiceNumber || undefined,
        purchaseDate: createForm.purchaseDate || undefined,
        warehouseId: createForm.warehouseId,
        notes: createForm.notes || undefined,
        items: createForm.items.map((i) => ({
          variantId: i.variantId,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
        })),
      });
      setSuccessMessage(res.message);
      setIsCreateOpen(false);
      setCreateForm(emptyCreateForm());
      refresh();
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to create purchase.');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Line item helpers (create) ─────────────────────────────────────────────
  const updateItem = (idx: number, field: keyof PurchaseLineItemForm, value: string) => {
    setCreateForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };
  const addItem = () =>
    setCreateForm((f) => ({ ...f, items: [...f.items, { variantId: '', quantity: '', unitCost: '' }] }));
  const removeItem = (idx: number) =>
    setCreateForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  // ── Edit metadata ──────────────────────────────────────────────────────────
  const openEdit = (p: Purchase) => {
    setEditingPurchase(p);
    setEditSupplier(p.supplierName ?? '');
    setEditNotes(p.notes ?? '');
  };
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await api.patch<{ data: Purchase; message: string }>(
        `/purchases/${editingPurchase.id}`,
        { supplierName: editSupplier || undefined, notes: editNotes || undefined },
      );
      setSuccessMessage(res.message);
      setEditingPurchase(null);
      refresh();
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to update purchase.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Void ───────────────────────────────────────────────────────────────────
  const handleVoid = async () => {
    if (!voidTarget) return;
    setIsVoiding(true);
    setErrorMessage(null);
    try {
      const res = await api.post<{ message: string }>(`/purchases/${voidTarget.id}/void`, {});
      setSuccessMessage(res.message);
      setVoidTarget(null);
      refresh();
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to void purchase.');
      setVoidTarget(null);
    } finally {
      setIsVoiding(false);
    }
  };

  // ── Return ─────────────────────────────────────────────────────────────────
  const openReturn = (p: Purchase) => {
    setReturnTarget(p);
    const form = emptyReturnForm();
    if (warehouses.length > 0) form.warehouseId = warehouses[0].id;
    if (p.items.length > 0 && p.items[0].variantId) {
      form.items = [{ variantId: p.items[0].variantId, quantity: '' }];
    }
    setReturnForm(form);
  };

  const updateReturnItem = (idx: number, field: keyof ReturnLineItemForm, value: string) => {
    setReturnForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };
  const addReturnRow = () =>
    setReturnForm((f) => ({ ...f, items: [...f.items, { variantId: '', quantity: '' }] }));
  const removeReturnRow = (idx: number) =>
    setReturnForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;
    if (returnForm.items.some((i) => !i.variantId || !i.quantity)) {
      setErrorMessage('All return rows need a variant and a quantity.');
      return;
    }
    setIsReturning(true);
    setErrorMessage(null);
    try {
      const res = await api.post<{ message: string }>(
        `/purchases/${returnTarget.id}/returns`,
        {
          warehouseId: returnForm.warehouseId,
          returnDate: returnForm.returnDate || undefined,
          notes: returnForm.notes || undefined,
          items: returnForm.items.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
          })),
        },
      );
      setSuccessMessage(res.message);
      setReturnTarget(null);
      refresh();
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Failed to process return.');
      setReturnTarget(null);
    } finally {
      setIsReturning(false);
    }
  };

  // ── Get variant options from a specific purchase (for return modal) ─────────
  const purchaseVariantOptions = (p: Purchase): VariantOption[] =>
    p.items
      .filter((i) => i.variantId && i.variant)
      .map((i) => ({
        id: i.variantId!,
        label: [i.variant?.product?.name, i.variant?.color, i.variant?.origin, i.variant?.sku]
          .filter(Boolean)
          .join(' · '),
        sku: i.variant?.sku ?? null,
      }));

  // ── Compute line total for create form ─────────────────────────────────────
  const lineTotal = (item: PurchaseLineItemForm) => {
    const q = parseFloat(item.quantity);
    const c = parseFloat(item.unitCost);
    if (!isNaN(q) && !isNaN(c)) return (q * c).toFixed(2);
    return '—';
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout breadcrumb="Purchases">
      <div className="space-y-5">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PurchasesIcon className="w-5 h-5 text-emerald-500" />
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                Purchases
              </h1>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Create purchases with{' '}
              <span className="text-emerald-500 dark:text-emerald-400 font-medium">multiple</span>{' '}
              items and track{' '}
              <span className="text-emerald-500 dark:text-emerald-400 font-medium">inventory</span>{' '}
              layers.
            </p>
          </div>
          {canMutate && (
            <button
              id="btn-make-purchase"
              onClick={() => { setCreateForm(emptyCreateForm()); setIsCreateOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-sm font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap self-start"
            >
              <PlusIcon className="w-4 h-4" />
              Make Purchase
            </button>
          )}
        </div>

        {/* ── Alerts ────────────────────────────────────────────────────────── */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircleIcon className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">✕</button>
          </div>
        )}
        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 text-sm">
            <CheckCircleIcon className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1 font-medium">{successMessage}</div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200 cursor-pointer">✕</button>
          </div>
        )}

        {/* ── Filter Bar ────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            {/* Search Supplier */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Search Supplier
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  placeholder="Search supplier..."
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Status
              </label>
              <select
                value={pendingStatus}
                onChange={(e) => setPendingStatus(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              >
                <option value="">All statuses</option>
                <option value="POSTED">POSTED</option>
                <option value="VOIDED">VOIDED</option>
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={pendingDate}
                onChange={(e) => setPendingDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              />
            </div>

            {/* Date Order + buttons */}
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Date Order
              </label>
              <div className="flex gap-2">
                <select
                  value={pendingOrder}
                  onChange={(e) => setPendingOrder(e.target.value as 'asc' | 'desc')}
                  className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                >
                  <option value="desc">Newest first</option>
                  <option value="asc">Oldest first</option>
                </select>
                <button
                  onClick={handleApply}
                  className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold cursor-pointer hover:bg-zinc-800 dark:hover:bg-white transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Purchases Table ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                  {['Supplier', 'Invoice', 'Date', 'Status', 'Items', 'Total', 'Actions'].map((h) => (
                    <th key={h} className={`py-3.5 px-5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr><td colSpan={7} className="py-14 text-center text-zinc-400">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCwIcon className="w-4 h-4 animate-spin" />
                      Loading purchases...
                    </div>
                  </td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <PurchasesIcon className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                      <p className="text-zinc-400 text-sm">No purchases found.</p>
                    </div>
                  </td></tr>
                ) : purchases.map((p) => {
                  const isVoided = p.status === 'VOIDED';
                  return (
                    <tr key={p.id} className={`transition-colors group ${isVoided ? 'opacity-60' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'}`}>

                      {/* Supplier */}
                      <td className="py-3.5 px-5">
                        <span className={`font-semibold ${isVoided ? 'text-zinc-400 line-through' : 'text-zinc-900 dark:text-white'}`}>
                          {p.supplierName || <em className="font-normal text-zinc-400">No supplier</em>}
                        </span>
                      </td>

                      {/* Invoice */}
                      <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-300 font-mono text-xs">
                        {p.invoiceNumber || '—'}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-300 text-xs tabular-nums">
                        {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('en-CA') : '—'}
                      </td>

                      {/* Status badge */}
                      <td className="py-3.5 px-5">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          isVoided
                            ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {p.status}
                        </span>
                      </td>

                      {/* Items inline summary */}
                      <td className="py-3.5 px-5 max-w-[260px]">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold mb-1">
                          {p.items.length} {p.items.length === 1 ? 'item' : 'items'}
                        </div>
                        <div className="space-y-0.5">
                          {p.items.slice(0, 3).map((item) => (
                            <div key={item.id} className="text-[11px] text-zinc-400 truncate">
                              ↳{' '}
                              {item.variant?.sku || item.variant?.product?.name || 'Unknown'}{' '}
                              {item.variant?.color ? `· ${item.variant.color}` : ''}{' '}
                              {item.variant?.origin ? `· ${item.variant.origin}` : ''}{' '}
                              | Qty {parseFloat(item.quantity ?? '0').toFixed(0)}{' '}
                              | Cost {fmt(item.unitCost)}
                            </div>
                          ))}
                          {p.items.length > 3 && (
                            <div className="text-[11px] text-zinc-500 italic">+{p.items.length - 3} more…</div>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-white tabular-nums">
                        {fmt(p.totalAmount)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        {canMutate && !isVoided ? (
                          <div className="inline-flex items-center gap-1.5">
                            {/* Edit */}
                            <button
                              id={`btn-edit-purchase-${p.id}`}
                              onClick={() => openEdit(p)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <EditIcon className="w-3.5 h-3.5" />
                                Edit
                              </span>
                            </button>

                            {/* Return */}
                            <button
                              id={`btn-return-purchase-${p.id}`}
                              onClick={() => openReturn(p)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-300 dark:border-amber-600/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <RotateCcwIcon className="w-3.5 h-3.5" />
                                Return
                              </span>
                            </button>

                            {/* Void */}
                            <button
                              id={`btn-void-purchase-${p.id}`}
                              onClick={() => setVoidTarget(p)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-300 dark:border-rose-700/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <BanIcon className="w-3.5 h-3.5" />
                                Void
                              </span>
                            </button>
                          </div>
                        ) : isVoided ? (
                          <span className="text-xs text-zinc-400 italic">Voided</span>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && (
            <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Showing {purchases.length > 0 ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, meta.total)}` : 0} of {meta.total}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2">Page {page} of {meta.totalPages}</span>
                <button
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Make Purchase
      ══════════════════════════════════════════════════════════════════════ */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <PlusIcon className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Make Purchase</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              <form id="create-purchase-form" onSubmit={handleCreate} className="space-y-4 text-sm">
                {/* Row 1: Supplier + Invoice */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Supplier Name
                    </label>
                    <input
                      id="create-purchase-supplier"
                      type="text"
                      value={createForm.supplierName}
                      onChange={(e) => setCreateForm({ ...createForm, supplierName: e.target.value })}
                      placeholder="e.g. Gulf Extrusions LLC"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Invoice Number
                    </label>
                    <input
                      id="create-purchase-invoice"
                      type="text"
                      value={createForm.invoiceNumber}
                      onChange={(e) => setCreateForm({ ...createForm, invoiceNumber: e.target.value })}
                      placeholder="e.g. INV-2026-9041"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Row 2: Date + Warehouse */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Purchase Date
                    </label>
                    <input
                      id="create-purchase-date"
                      type="date"
                      value={createForm.purchaseDate}
                      onChange={(e) => setCreateForm({ ...createForm, purchaseDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                      Destination Warehouse <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="create-purchase-warehouse"
                      required
                      value={createForm.warehouseId}
                      onChange={(e) => setCreateForm({ ...createForm, warehouseId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="">Select warehouse…</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Notes <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <textarea
                    id="create-purchase-notes"
                    rows={2}
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    placeholder="Urgent container shipment…"
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                      Line Items <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-semibold"
                    >
                      + Add Item
                    </button>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_100px_100px_80px_28px] gap-2 mb-1.5 px-1">
                    {['Variant', 'Qty', 'Unit Cost', 'Total', ''].map((h) => (
                      <div key={h} className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{h}</div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {createForm.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_100px_100px_80px_28px] gap-2 items-center">
                        <select
                          required
                          value={item.variantId}
                          onChange={(e) => updateItem(idx, 'variantId', e.target.value)}
                          className="w-full px-2.5 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        >
                          <option value="">Select variant…</option>
                          {variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full px-2.5 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          placeholder="Cost"
                          value={item.unitCost}
                          onChange={(e) => updateItem(idx, 'unitCost', e.target.value)}
                          className="w-full px-2.5 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        />
                        <div className="text-xs text-zinc-400 tabular-nums text-right">
                          {lineTotal(item)}
                        </div>
                        {createForm.items.length > 1 ? (
                          <button type="button" onClick={() => removeItem(idx)} className="text-zinc-400 hover:text-rose-400 cursor-pointer">
                            <Trash2Icon className="w-4 h-4" />
                          </button>
                        ) : <div />}
                      </div>
                    ))}
                  </div>

                  {/* Grand total preview */}
                  <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                    <div className="text-xs text-zinc-500">
                      Estimated total:{' '}
                      <span className="font-bold text-zinc-900 dark:text-white">
                        {createForm.items.reduce((sum, i) => {
                          const t = parseFloat(lineTotal(i));
                          return sum + (isNaN(t) ? 0 : t);
                        }, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                form="create-purchase-form"
                type="submit"
                disabled={isCreating}
                className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-semibold cursor-pointer text-sm shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isCreating && <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />}
                Create Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Edit Purchase (metadata only)
      ══════════════════════════════════════════════════════════════════════ */}
      {editingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Edit Purchase</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Only non-financial fields can be edited after posting.</p>
              </div>
              <button onClick={() => setEditingPurchase(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Supplier Name
                </label>
                <input
                  id="edit-purchase-supplier"
                  type="text"
                  value={editSupplier}
                  onChange={(e) => setEditSupplier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Notes
                </label>
                <textarea
                  id="edit-purchase-notes"
                  rows={4}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingPurchase(null)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={isUpdating}
                  className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-semibold cursor-pointer text-sm shadow-xs disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  {isUpdating && <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Void Confirmation (double-confirm)
      ══════════════════════════════════════════════════════════════════════ */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <BanIcon className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Void Purchase?</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  You are about to void the purchase from{' '}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    &quot;{voidTarget.supplierName || 'Unknown Supplier'}&quot;
                  </span>
                  {voidTarget.invoiceNumber ? ` (Invoice: ${voidTarget.invoiceNumber})` : ''}.
                </p>
              </div>
              <button onClick={() => setVoidTarget(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer shrink-0">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-700/40 text-xs text-rose-700 dark:text-rose-400 space-y-1">
              <p className="font-bold">This action cannot be undone. It will:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Mark this purchase as <strong>VOIDED</strong></li>
                <li>Write compensating <strong>PURCHASE_RETURN</strong> ledger entries</li>
                <li>Deplete unconsumed inventory cost layers</li>
                <li>Reduce warehouse stock accordingly</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setVoidTarget(null)}
                className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm transition-colors">
                Cancel
              </button>
              <button
                id={`btn-confirm-void-${voidTarget.id}`}
                onClick={handleVoid}
                disabled={isVoiding}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer text-sm shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isVoiding && <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />}
                Yes, Void Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: Return Purchase Items
      ══════════════════════════════════════════════════════════════════════ */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Return Purchase Items</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  This will reverse stock and financial impact for selected quantities.
                </p>
              </div>
              <button onClick={() => setReturnTarget(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturn} className="space-y-4 text-sm">
              {/* Warehouse + Return Date + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Warehouse <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={returnForm.warehouseId}
                    onChange={(e) => setReturnForm({ ...returnForm, warehouseId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  >
                    <option value="">Select…</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Return Date
                  </label>
                  <input
                    type="date"
                    value={returnForm.returnDate}
                    onChange={(e) => setReturnForm({ ...returnForm, returnDate: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                  Notes <span className="font-normal text-zinc-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="e.g. 10 profiles damaged in transit"
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              </div>

              {/* Return Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Return Items
                  </span>
                  <button type="button" onClick={addReturnRow}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-semibold">
                    Add Row
                  </button>
                </div>

                {/* Header */}
                <div className="grid grid-cols-[1fr_100px_28px] gap-2 mb-1.5 px-1">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Variant</div>
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Quantity</div>
                  <div />
                </div>

                <div className="space-y-2">
                  {returnForm.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_100px_28px] gap-2 items-center">
                      <select
                        required
                        value={item.variantId}
                        onChange={(e) => updateReturnItem(idx, 'variantId', e.target.value)}
                        className="w-full px-2.5 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      >
                        <option value="">Select variant…</option>
                        {purchaseVariantOptions(returnTarget).map((v) => (
                          <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        required
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateReturnItem(idx, 'quantity', e.target.value)}
                        className="w-full px-2.5 py-2 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      {returnForm.items.length > 1 ? (
                        <button type="button" onClick={() => removeReturnRow(idx)}
                          className="text-zinc-400 hover:text-rose-400 cursor-pointer">
                          <Trash2Icon className="w-4 h-4" />
                        </button>
                      ) : <div />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setReturnTarget(null)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={isReturning}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer text-sm shadow-xs disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  {isReturning && <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />}
                  Save Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
