'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/app-layout';
import { api } from '@/lib/api';
import {
  Warehouse,
  WarehouseStockItem,
  WarehouseListResponse,
  WarehouseCreateResponse,
} from '@/types/warehouses';
import {
  WarehouseIcon,
  PlusIcon,
  Trash2Icon,
  EditIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  Building2Icon,
  SearchIcon,
  XIcon,
} from '@/components/icons';

// ─── Map Icon (pin) ────────────────────────────────────────────────────────────
function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

// ─── Eye / View Icon ───────────────────────────────────────────────────────────
function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── Number Formatter ─────────────────────────────────────────────────────────
const fmtStock = (n: number | string | null | undefined): string => {
  if (n === null || n === undefined) return '0.00';
  const num = typeof n === 'number' ? n : parseFloat(String(n));
  return isNaN(num)
    ? '0.00'
    : num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

export default function WarehousesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // ── State ──────────────────────────────────────────────────────────────────
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Create modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', location: '' });
  const [isCreating, setIsCreating] = useState(false);

  // Edit modal
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [editForm, setEditForm] = useState({ name: '', location: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete confirmation modal
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Live Stock Drawer State ────────────────────────────────────────────────
  const [viewingStockWarehouse, setViewingStockWarehouse] = useState<Warehouse | null>(null);
  const [stockItems, setStockItems] = useState<WarehouseStockItem[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [stockErrorMessage, setStockErrorMessage] = useState<string | null>(null);
  const [stockSearchQuery, setStockSearchQuery] = useState('');

  // ── Data Fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    let cancelled = false;

    async function loadWarehouses() {
      setIsLoading(true);
      try {
        const res = await api.get<WarehouseListResponse>('/warehouses');
        if (!cancelled) {
          setWarehouses(res.data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load warehouses.';
          setErrorMessage(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadWarehouses();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, authLoading, isAuthenticated]);

  const refresh = useCallback(() => setRefreshTrigger((n) => n + 1), []);

  // Fetch Live Warehouse Stock
  const fetchWarehouseStock = useCallback(async (warehouseId: string) => {
    setIsLoadingStock(true);
    setStockErrorMessage(null);
    try {
      const res = await api.get<{ data: WarehouseStockItem[] }>(
        `/warehouses/${warehouseId}/stock`,
      );
      setStockItems(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load live stock balances.';
      setStockErrorMessage(msg);
    } finally {
      setIsLoadingStock(false);
    }
  }, []);

  const openStockDrawer = (wh: Warehouse) => {
    setViewingStockWarehouse(wh);
    setStockSearchQuery('');
    fetchWarehouseStock(wh.id);
  };

  // Keyboard shortcut to close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewingStockWarehouse) {
        setViewingStockWarehouse(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingStockWarehouse]);

  // In-drawer search filter
  const filteredStockItems = useMemo(() => {
    if (!stockSearchQuery.trim()) return stockItems;
    const q = stockSearchQuery.trim().toLowerCase();
    return stockItems.filter(
      (item) =>
        item.product_name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.color && item.color.toLowerCase().includes(q)) ||
        (item.origin && item.origin.toLowerCase().includes(q)),
    );
  }, [stockItems, stockSearchQuery]);

  const totalStockUnits = useMemo(() => {
    return stockItems.reduce((acc, item) => acc + (item.total_stock || 0), 0);
  }, [stockItems]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setErrorMessage(null);
    try {
      const res = await api.post<WarehouseCreateResponse>('/warehouses', {
        name: createForm.name.trim(),
        location: createForm.location.trim() || undefined,
      });
      setSuccessMessage(res.message);
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', location: '' });
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create warehouse.';
      setErrorMessage(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWarehouse) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const res = await api.patch<{ data: Warehouse; message: string }>(
        `/warehouses/${editingWarehouse.id}`,
        {
          name: editForm.name.trim(),
          location: editForm.location.trim() || undefined,
        },
      );
      setSuccessMessage(res.message);
      setEditingWarehouse(null);
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update warehouse.';
      setErrorMessage(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingWarehouse) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await api.delete<{ message: string }>(`/warehouses/${deletingWarehouse.id}`);
      setSuccessMessage(res.message);
      setDeletingWarehouse(null);
      refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete warehouse.';
      setErrorMessage(msg);
      setDeletingWarehouse(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setEditForm({ name: wh.name ?? '', location: wh.location ?? '' });
  };

  return (
    <AppLayout breadcrumb="Warehouses">
      <div className="space-y-6">
        {/* ── Page Header ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Warehouses
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Physical storage facilities, depots, and real-time inventory balances
            </p>
          </div>

          {isAdmin && (
            <button
              id="btn-add-warehouse"
              onClick={() => {
                setCreateForm({ name: '', location: '' });
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-sm font-semibold shadow-sm transition-all cursor-pointer self-start sm:self-auto whitespace-nowrap"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Warehouse</span>
            </button>
          )}
        </div>

        {/* ── Feedback Alerts ───────────────────────────────────────────────── */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircleIcon className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 text-sm">
            <CheckCircleIcon className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1 font-medium">{successMessage}</div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Warehouse Table ───────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
                  <th className="py-3.5 px-6 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="py-3.5 px-6 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="py-3.5 px-6 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="py-14 text-center text-zinc-400">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCwIcon className="w-4 h-4 animate-spin text-zinc-500" />
                        <span>Loading warehouses...</span>
                      </div>
                    </td>
                  </tr>
                ) : warehouses.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Building2Icon className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                        <p className="text-zinc-400 text-sm">No warehouses configured yet.</p>
                        {isAdmin && (
                          <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="text-sm text-amber-600 dark:text-amber-400 hover:underline font-medium cursor-pointer"
                          >
                            Add your first warehouse →
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  warehouses.map((wh) => (
                    <tr
                      key={wh.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                            <WarehouseIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {wh.name ?? '—'}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-4 px-6">
                        {wh.location ? (
                          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 text-sm">
                            <MapPinIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span>{wh.location}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-sm italic">No location set</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          {/* Live Stock Drawer Trigger */}
                          <button
                            id={`btn-view-warehouse-${wh.id}`}
                            onClick={() => openStockDrawer(wh)}
                            title="View live stock"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <EyeIcon className="w-3.5 h-3.5" />
                              View
                            </span>
                          </button>

                          {isAdmin && (
                            <>
                              <button
                                id={`btn-edit-warehouse-${wh.id}`}
                                onClick={() => openEditModal(wh)}
                                title="Edit warehouse"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5">
                                  <EditIcon className="w-3.5 h-3.5" />
                                  Edit
                                </span>
                              </button>

                              <button
                                id={`btn-delete-warehouse-${wh.id}`}
                                onClick={() => setDeletingWarehouse(wh)}
                                title="Delete warehouse"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-300 dark:border-rose-700/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-400 dark:hover:border-rose-600 transition-all cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Trash2Icon className="w-3.5 h-3.5" />
                                  Delete
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Slide-Over Drawer: Live Warehouse Stock ───────────────────────── */}
        {viewingStockWarehouse && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
              onClick={() => setViewingStockWarehouse(null)}
              aria-hidden="true"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <aside className="w-screen max-w-2xl bg-white dark:bg-[#0c0d10] border-l border-zinc-200 dark:border-zinc-800/80 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <WarehouseIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                        {viewingStockWarehouse.name}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {viewingStockWarehouse.location && (
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="w-3 h-3 text-zinc-400" />
                          {viewingStockWarehouse.location}
                        </span>
                      )}
                      {viewingStockWarehouse.location && <span>•</span>}
                      <span>
                        {stockItems.length} {stockItems.length === 1 ? 'variant' : 'variants'} in stock
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {fmtStock(totalStockUnits)} total units
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => fetchWarehouseStock(viewingStockWarehouse.id)}
                      disabled={isLoadingStock}
                      title="Refresh stock balances"
                      className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCwIcon className={`w-4 h-4 ${isLoadingStock ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => setViewingStockWarehouse(null)}
                      title="Close drawer"
                      className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <XIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Compact Search Filter Bar */}
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/20">
                  <div className="relative">
                    <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Filter by product, SKU, or finish..."
                      value={stockSearchQuery}
                      onChange={(e) => setStockSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-colors"
                    />
                    {stockSearchQuery && (
                      <button
                        onClick={() => setStockSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Error Alert */}
                {stockErrorMessage && (
                  <div className="m-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
                    <span>{stockErrorMessage}</span>
                    <button
                      onClick={() => fetchWarehouseStock(viewingStockWarehouse.id)}
                      className="underline font-medium hover:text-rose-300 ml-2 cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Table / List Content */}
                <div className="flex-1 overflow-y-auto">
                  {isLoadingStock && stockItems.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                      <RefreshCwIcon className="w-5 h-5 animate-spin text-zinc-500" />
                      <span>Calculating real-time inventory ledger...</span>
                    </div>
                  ) : filteredStockItems.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-4">
                      <WarehouseIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        {stockSearchQuery
                          ? `No matching items found for "${stockSearchQuery}"`
                          : 'No active stock found in this warehouse.'}
                      </p>
                      {stockSearchQuery && (
                        <button
                          onClick={() => setStockSearchQuery('')}
                          className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          Clear search filter
                        </button>
                      )}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">
                            Product & SKU
                          </th>
                          <th className="py-2.5 px-4 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px]">
                            Finish & Origin
                          </th>
                          <th className="py-2.5 px-4 font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] text-right">
                            Available Stock
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                        {filteredStockItems.map((item) => (
                          <tr
                            key={item.variant_id}
                            className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors"
                          >
                            {/* Column 1: Product & SKU */}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-zinc-900 dark:text-white">
                                {item.product_name}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                <span className="font-mono">{item.sku || 'No SKU'}</span>
                                {(item.thickness || item.size) && (
                                  <>
                                    <span>•</span>
                                    <span>
                                      {[
                                        item.thickness ? `${item.thickness}mm` : null,
                                        item.size,
                                      ]
                                        .filter(Boolean)
                                        .join(' / ')}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Column 2: Finish & Origin */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60">
                                  {item.color || 'Standard'}
                                </span>
                                {item.origin && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                      item.origin === 'IMPORTED'
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    }`}
                                  >
                                    {item.origin}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Column 3: Available Stock */}
                            <td className="py-3 px-4 text-right">
                              <div className="font-bold text-sm text-zinc-900 dark:text-white font-mono">
                                {fmtStock(item.total_stock)}
                              </div>
                              <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                units on-hand
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Drawer Footer */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Showing {filteredStockItems.length} of {stockItems.length} items
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewingStockWarehouse(null)}
                    className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* ── Modal: Add Warehouse ───────────────────────────────────────────── */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <PlusIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Add Warehouse
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4 text-sm">
                <div>
                  <label
                    htmlFor="create-warehouse-name"
                    className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Warehouse Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="create-warehouse-name"
                    type="text"
                    required
                    placeholder="e.g. Main Distribution Yard"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 dark:focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="create-warehouse-location"
                    className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Physical Location
                    <span className="ml-1 text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="create-warehouse-location"
                    type="text"
                    placeholder="e.g. Industrial Area 3, Gate 4"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 dark:focus:ring-amber-500/40"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium cursor-pointer text-sm shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {isCreating && <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />}
                    Create Warehouse
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Edit Warehouse ──────────────────────────────────────────── */}
        {editingWarehouse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <EditIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Edit Warehouse
                  </h3>
                </div>
                <button
                  onClick={() => setEditingWarehouse(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="space-y-4 text-sm">
                <div>
                  <label
                    htmlFor="edit-warehouse-name"
                    className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Warehouse Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="edit-warehouse-name"
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 dark:focus:ring-amber-500/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-warehouse-location"
                    className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    Physical Location
                    <span className="ml-1 text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="edit-warehouse-location"
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50 dark:focus:ring-amber-500/40"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingWarehouse(null)}
                    className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-medium cursor-pointer text-sm shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {isUpdating && <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Delete Confirmation ──────────────────────────────────────── */}
        {deletingWarehouse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <Trash2Icon className="w-5 h-5 text-rose-500" />
                </div>
                <button
                  onClick={() => setDeletingWarehouse(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
                  Delete Warehouse?
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  You are about to delete{' '}
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    &quot;{deletingWarehouse.name}&quot;
                  </span>
                  . This action cannot be undone.
                </p>
                <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-400">
                  <strong>Safety Barrier:</strong> Warehouses with existing inventory transactions
                  cannot be deleted to preserve ledger integrity.
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingWarehouse(null)}
                  className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer text-sm shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {isDeleting && <RefreshCwIcon className="w-3.5 h-3.5 animate-spin" />}
                  Delete Warehouse
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
