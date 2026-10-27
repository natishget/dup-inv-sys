'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppLayout } from '@/components/app-layout';
import {
  Product,
  ProductVariant,
  ProductOrigin,
  PaginatedVariantsResponse,
} from '@/types/products';
import { api } from '@/lib/api';
import {
  SearchIcon,
  Trash2Icon,
  EditIcon,
  XIcon,
  MoreVerticalIcon,
  FileJsonIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  RefreshCwIcon,
} from '@/components/icons';

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatThickness(val: string | number | null): string {
  if (val === null || val === undefined) return '-';
  const num = Number(val);
  return isNaN(num) ? String(val) : num.toFixed(2);
}

export default function ProductsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Variant table state
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [totalVariants, setTotalVariants] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  // Filter Bar state
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<'ALL' | ProductOrigin>('ALL');
  const [appliedOrigin, setAppliedOrigin] = useState<'ALL' | ProductOrigin>('ALL');
  const [colorFilter, setColorFilter] = useState<string>('ALL');
  const [appliedColor, setAppliedColor] = useState<string>('ALL');
  const [colorOptions, setColorOptions] = useState<string[]>([]);

  // Master products list for variant creation
  const [masterProducts, setMasterProducts] = useState<Product[]>([]);

  // UI Alerts / Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newlyCreatedProduct, setNewlyCreatedProduct] = useState<Product | null>(null);

  // Active Dropdown Menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modals state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddVariantOpen, setIsAddVariantOpen] = useState(false);
  const [isEditVariantOpen, setIsEditVariantOpen] = useState(false);
  const [isImportJsonOpen, setIsImportJsonOpen] = useState(false);

  // Add Product Form
  const [productForm, setProductForm] = useState({
    name: '',
    baseUnit: '',
  });

  // Variant Form (Create / Edit)
  const [variantForm, setVariantForm] = useState<{
    productId: string;
    origin: ProductOrigin | 'NONE';
    color: string;
    sku: string;
    thickness: string;
    size: string;
  }>({
    productId: '',
    origin: 'NONE',
    color: '',
    sku: '',
    thickness: '',
    size: '',
  });
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  // Import JSON Form
  const [importJsonText, setImportJsonText] = useState('');

  // Refresh trigger counter
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refreshData = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Fetch Master Products (for variant modal selection)
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let active = true;
    async function loadMasterProducts() {
      try {
        const res = await api.get<Product[]>('/products');
        if (active) {
          setMasterProducts(res);
        }
      } catch (err) {
        console.error('Failed to load master products', err);
      }
    }
    loadMasterProducts();
    return () => {
      active = false;
    };
  }, [refreshTrigger, authLoading, isAuthenticated]);

  // Fetch Distinct Colors for filter dropdown
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let active = true;
    async function loadColors() {
      try {
        const colors = await api.get<string[]>('/products/variants/colors');
        if (active) {
          setColorOptions(colors);
        }
      } catch (err) {
        console.error('Failed to load distinct colors', err);
      }
    }
    loadColors();
    return () => {
      active = false;
    };
  }, [refreshTrigger, authLoading, isAuthenticated]);

  // Fetch Paginated Variants with applied filters
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    let active = true;
    async function loadVariants() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(limit));
        if (appliedSearch.trim()) params.set('q', appliedSearch.trim());
        if (appliedOrigin !== 'ALL') params.set('origin', appliedOrigin);
        if (appliedColor !== 'ALL') params.set('color', appliedColor);

        const res = await api.get<PaginatedVariantsResponse>(
          `/products/variants?${params.toString()}`,
        );
        if (active) {
          setVariants(res.data);
          setTotalVariants(res.meta.total);
          setTotalPages(res.meta.totalPages);
        }
      } catch (err: unknown) {
        if (active) {
          const msg =
            err instanceof Error ? err.message : 'Failed to fetch product catalog';
          setErrorMessage(msg);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }
    loadVariants();
    return () => {
      active = false;
    };
  }, [page, limit, appliedSearch, appliedOrigin, appliedColor, refreshTrigger, authLoading, isAuthenticated]);

  // Handle Apply Filter
  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput);
    setAppliedOrigin(originFilter);
    setAppliedColor(colorFilter);
  };

  // Handle Reset Filter
  const handleResetFilter = () => {
    setSearchInput('');
    setAppliedSearch('');
    setOriginFilter('ALL');
    setAppliedOrigin('ALL');
    setColorFilter('ALL');
    setAppliedColor('ALL');
    setPage(1);
  };

  // Close row actions dropdown on click outside
  useEffect(() => {
    const handleDocumentClick = () => {
      setActiveMenuId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Live JSON validation for Import modal
  const { validatedJsonItems, jsonSyntaxError } = useMemo(() => {
    if (!importJsonText.trim()) {
      return { validatedJsonItems: null, jsonSyntaxError: null };
    }
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) {
        return {
          validatedJsonItems: null,
          jsonSyntaxError: 'JSON payload must be an array of product objects.',
        };
      }
      return { validatedJsonItems: parsed, jsonSyntaxError: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON format';
      return { validatedJsonItems: null, jsonSyntaxError: msg };
    }
  }, [importJsonText]);

  // Handle Create Master Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await api.post<Product>('/products', {
        name: productForm.name.trim(),
        baseUnit: productForm.baseUnit.trim() || undefined,
      });

      setSuccessMessage(`Master product "${created.name}" created successfully.`);
      setNewlyCreatedProduct(created);
      setIsAddProductOpen(false);
      setProductForm({ name: '', baseUnit: '' });
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create product';
      setErrorMessage(msg);
    }
  };

  // Handle Create Variant
  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantForm.productId) {
      setErrorMessage('Please select a parent product.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const thicknessNum = variantForm.thickness.trim()
        ? parseFloat(variantForm.thickness.trim())
        : undefined;

      await api.post('/products/variants', {
        productId: variantForm.productId,
        origin: variantForm.origin === 'NONE' ? undefined : variantForm.origin,
        color: variantForm.color.trim() || undefined,
        sku: variantForm.sku.trim() || undefined,
        thickness: isNaN(thicknessNum as number) ? undefined : thicknessNum,
        size: variantForm.size.trim() || undefined,
      });

      setSuccessMessage(
        variantForm.sku
          ? `Variant with SKU "${variantForm.sku}" created successfully.`
          : 'Product variant created successfully.',
      );
      setIsAddVariantOpen(false);
      setNewlyCreatedProduct(null);
      setVariantForm({
        productId: '',
        origin: 'NONE',
        color: '',
        sku: '',
        thickness: '',
        size: '',
      });
      refreshData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create product variant';
      setErrorMessage(msg);
    }
  };

  // Open Edit Modal for a Variant
  const openEditVariant = (variant: ProductVariant) => {
    setEditingVariantId(variant.id);
    setVariantForm({
      productId: variant.productId || '',
      origin: variant.origin || 'NONE',
      color: variant.color || '',
      sku: variant.sku || '',
      thickness: variant.thickness !== null ? String(variant.thickness) : '',
      size: variant.size || '',
    });
    setIsEditVariantOpen(true);
  };

  // Handle Update Variant
  const handleUpdateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariantId) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const thicknessNum = variantForm.thickness.trim()
        ? parseFloat(variantForm.thickness.trim())
        : undefined;

      await api.patch(`/products/variants/${editingVariantId}`, {
        origin: variantForm.origin === 'NONE' ? null : variantForm.origin,
        color: variantForm.color.trim() || null,
        sku: variantForm.sku.trim() || null,
        thickness: isNaN(thicknessNum as number) ? null : thicknessNum,
        size: variantForm.size.trim() || null,
      });

      setSuccessMessage('Product variant updated successfully.');
      setIsEditVariantOpen(false);
      setEditingVariantId(null);
      refreshData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update product variant';
      setErrorMessage(msg);
    }
  };

  // Handle Delete Variant
  const handleDeleteVariant = async (variant: ProductVariant) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete variant ${variant.sku ? `"${variant.sku}"` : `ID ${variant.id.slice(0, 8)}`}?`,
    );
    if (!confirmDelete) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.delete(`/products/variants/${variant.id}`);
      setSuccessMessage('Product variant deleted successfully.');
      refreshData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete product variant';
      setErrorMessage(msg);
    }
  };

  // Handle Delete Master Product
  const handleDeleteMasterProduct = async (productId: string, productName: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete master product "${productName}"? This is only possible if it has no child variants.`,
    );
    if (!confirmDelete) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.delete(`/products/${productId}`);
      setSuccessMessage(`Product "${productName}" deleted successfully.`);
      refreshData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete master product';
      setErrorMessage(msg);
    }
  };

  // Handle Import JSON
  const handleImportJson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatedJsonItems || validatedJsonItems.length === 0) {
      setErrorMessage('Please provide a valid JSON array of products to import.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.post<{
        message: string;
        importedProductsCount: number;
        importedVariantsCount: number;
      }>('/products/import', {
        products_json: importJsonText,
      });

      setSuccessMessage(res.message);
      setIsImportJsonOpen(false);
      setImportJsonText('');
      refreshData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to bulk import products';
      setErrorMessage(msg);
    }
  };

  // Load sample JSON into Import modal
  const loadSampleJson = () => {
    const sample = [
      {
        name: 'Curtain Wall Profile 50',
        unit: 'METER',
        variants: [
          {
            sku: 'CW-50-BRZ',
            color: 'Bronze',
            origin: 'IMPORTED',
            thickness: 1.5,
            size: '6.0m',
          },
          {
            sku: 'CW-50-SLV',
            color: 'Silver',
            origin: 'LOCAL',
            thickness: 1.2,
            size: '5.8m',
          },
        ],
      },
      {
        name: 'Sliding Window Track',
        unit: 'Piece',
      },
    ];
    setImportJsonText(JSON.stringify(sample, null, 2));
  };

  // Open Add Variant modal with pre-selected product
  const openAddVariantForProduct = (prod: Product) => {
    setVariantForm({
      productId: prod.id,
      origin: 'NONE',
      color: '',
      sku: '',
      thickness: '',
      size: '',
    });
    setIsAddVariantOpen(true);
  };

  // Compute pagination range text
  const startItemIndex = totalVariants === 0 ? 0 : (page - 1) * limit + 1;
  const endItemIndex = Math.min(page * limit, totalVariants);

  return (
    <AppLayout breadcrumb="Product Management">
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Success Alert Banner */}
        {successMessage && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircleIcon className="w-5 h-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400/80 hover:text-emerald-200"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Shortcut Banner after creating a Master Product */}
        {newlyCreatedProduct && (
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 text-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                Master product <strong>{newlyCreatedProduct.name}</strong> was created.
                Add its first variant to display it in the catalog table.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAddVariantForProduct(newlyCreatedProduct)}
                className="bg-amber-400 text-zinc-950 hover:bg-amber-300 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0"
              >
                + Add Variant Now
              </button>
              <button
                onClick={() => setNewlyCreatedProduct(null)}
                className="text-amber-400/80 hover:text-amber-200"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-400 text-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400/80 hover:text-red-200"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Card Container */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0e] shadow-sm overflow-hidden">
          {/* Header & Action Buttons */}
          <div className="p-4 sm:p-6 md:p-8 border-b border-zinc-200 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Product Management
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Manage products, create variants, and review every variant as its own
                table row.
              </p>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <button
                  id="add-product-btn"
                  onClick={() => setIsAddProductOpen(true)}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white font-semibold text-xs md:text-sm px-3.5 sm:px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Add Product
                </button>
                <button
                  id="add-variant-btn"
                  onClick={() => {
                    setVariantForm({
                      productId: masterProducts[0]?.id || '',
                      origin: 'NONE',
                      color: '',
                      sku: '',
                      thickness: '',
                      size: '',
                    });
                    setIsAddVariantOpen(true);
                  }}
                  className="bg-white dark:bg-zinc-800/90 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-xs md:text-sm px-3.5 sm:px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700/60 transition-colors shadow-2xs cursor-pointer"
                >
                  Add Product Variant
                </button>
                <button
                  id="import-json-btn"
                  onClick={() => setIsImportJsonOpen(true)}
                  className="bg-white dark:bg-zinc-800/90 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium text-xs md:text-sm px-3.5 sm:px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700/60 transition-colors shadow-2xs cursor-pointer"
                >
                  Import JSON
                </button>
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <form
            onSubmit={handleApplyFilter}
            className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-transparent grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end"
          >
            {/* Search Input */}
            <div className="lg:col-span-5">
              <label
                htmlFor="search-variants"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Search by product or SKU
              </label>
              <div className="relative">
                <SearchIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="search-variants"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search variants"
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                />
              </div>
            </div>

            {/* Origin Dropdown */}
            <div className="lg:col-span-3">
              <label
                htmlFor="origin-filter"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Origin
              </label>
              <select
                id="origin-filter"
                value={originFilter}
                onChange={(e) =>
                  setOriginFilter(e.target.value as 'ALL' | ProductOrigin)
                }
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
              >
                <option value="ALL">All origins</option>
                <option value="LOCAL">LOCAL</option>
                <option value="IMPORTED">IMPORTED</option>
              </select>
            </div>

            {/* Color Dropdown */}
            <div className="lg:col-span-2">
              <label
                htmlFor="color-filter"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Color
              </label>
              <select
                id="color-filter"
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
              >
                <option value="ALL">All colors</option>
                {colorOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                id="apply-filter-btn"
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-200 dark:hover:bg-white dark:text-zinc-950 text-xs font-semibold px-4 py-2 rounded-lg h-[38px] transition-colors cursor-pointer"
              >
                Apply
              </button>
              <button
                type="button"
                id="reset-filter-btn"
                onClick={handleResetFilter}
                className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 text-xs font-medium px-3 py-2 h-[38px] transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </form>

          {/* Variants Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800/80 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider bg-zinc-50/80 dark:bg-zinc-900/40">
                  <th className="py-3.5 px-6">Product</th>
                  <th className="py-3.5 px-4">Base Unit</th>
                  <th className="py-3.5 px-4">Origin</th>
                  <th className="py-3.5 px-4">Color</th>
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Thickness</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">Created</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/40">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 9 : 8}
                      className="py-12 text-center text-zinc-500 text-sm"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCwIcon className="w-4 h-4 animate-spin text-zinc-400" />
                        <span>Loading product variants...</span>
                      </div>
                    </td>
                  </tr>
                ) : variants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 9 : 8}
                      className="py-12 text-center text-zinc-500 text-sm"
                    >
                      No product variants found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  variants.map((v) => {
                    const isMenuOpen = activeMenuId === v.id;
                    return (
                      <tr
                        key={v.id}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/25 transition-colors group"
                      >
                        {/* Product Family Name & Variant ID */}
                        <td className="py-4 px-6">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                            {v.product?.name || 'Unnamed Product'}
                          </div>
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">
                            Variant ID: {v.id}
                          </div>
                        </td>

                        {/* Base Unit */}
                        <td className="py-4 px-4 text-zinc-700 dark:text-zinc-300 text-sm">
                          {v.product?.baseUnit || '-'}
                        </td>

                        {/* Origin Badge */}
                        <td className="py-4 px-4">
                          {v.origin === 'IMPORTED' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-300">
                              IMPORTED
                            </span>
                          ) : v.origin === 'LOCAL' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400">
                              LOCAL
                            </span>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-600 text-xs">-</span>
                          )}
                        </td>

                        {/* Color */}
                        <td className="py-4 px-4 text-zinc-700 dark:text-zinc-300 text-sm capitalize">
                          {v.color || '-'}
                        </td>

                        {/* SKU */}
                        <td className="py-4 px-4 text-zinc-800 dark:text-zinc-300 font-mono text-xs">
                          {v.sku || '-'}
                        </td>

                        {/* Thickness */}
                        <td className="py-4 px-4 text-zinc-700 dark:text-zinc-300 text-sm">
                          {formatThickness(v.thickness)}
                        </td>

                        {/* Size */}
                        <td className="py-4 px-4 text-zinc-700 dark:text-zinc-300 text-sm">
                          {v.size || '0'}
                        </td>

                        {/* Created Date */}
                        <td className="py-4 px-4 text-zinc-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                          {formatDate(v.createdAt)}
                        </td>

                        {/* Actions Menu */}
                        {isAdmin && (
                          <td className="py-4 px-4 text-right relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(isMenuOpen ? null : v.id);
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
                              title="Row actions"
                            >
                              <MoreVerticalIcon className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-6 top-10 w-48 bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl py-1.5 z-30 text-left"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    openEditVariant(v);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                                >
                                  <EditIcon className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Edit Variant</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleDeleteVariant(v);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                                >
                                  <Trash2Icon className="w-3.5 h-3.5" />
                                  <span>Delete Variant</span>
                                </button>
                                {v.product && (
                                  <>
                                    <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        handleDeleteMasterProduct(
                                          v.product!.id,
                                          v.product!.name,
                                        );
                                      }}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                                    >
                                      <span>Delete Master Product</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 md:px-6 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-transparent flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <div>
              Showing {startItemIndex}-{endItemIndex} of {totalVariants}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="prev-page-btn"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                id="next-page-btn"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Add New Product */}
      {isAddProductOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddProductOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add New Product</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Create a new product record.
            </p>

            <form onSubmit={handleCreateProduct} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Name
                </label>
                <input
                  id="product-name-input"
                  type="text"
                  required
                  autoFocus
                  value={productForm.name}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Base Unit
                </label>
                <input
                  id="product-unit-input"
                  type="text"
                  placeholder="Piece, meter, box..."
                  value={productForm.baseUnit}
                  onChange={(e) =>
                    setProductForm((prev) => ({ ...prev, baseUnit: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="save-product-submit-btn"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold px-4 py-2 rounded-lg text-xs md:text-sm transition-colors shadow-sm cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Product Variant */}
      {isAddVariantOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddVariantOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Add Product Variant
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Select a product and define the variant details.
            </p>

            <form onSubmit={handleCreateVariant} className="mt-5 space-y-4">
              {/* Product Select */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Product
                </label>
                <select
                  id="variant-product-select"
                  required
                  value={variantForm.productId}
                  onChange={(e) =>
                    setVariantForm((prev) => ({ ...prev, productId: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                >
                  <option value="" disabled>
                    Select product
                  </option>
                  {masterProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.baseUnit ? `(${p.baseUnit})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Origin Select */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Origin
                </label>
                <select
                  id="variant-origin-select"
                  value={variantForm.origin}
                  onChange={(e) =>
                    setVariantForm((prev) => ({
                      ...prev,
                      origin: e.target.value as ProductOrigin | 'NONE',
                    }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                >
                  <option value="NONE">None</option>
                  <option value="LOCAL">LOCAL</option>
                  <option value="IMPORTED">IMPORTED</option>
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Color
                </label>
                <input
                  id="variant-color-input"
                  type="text"
                  placeholder="Blue"
                  value={variantForm.color}
                  onChange={(e) =>
                    setVariantForm((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  SKU
                </label>
                <input
                  id="variant-sku-input"
                  type="text"
                  placeholder="SKU-001"
                  value={variantForm.sku}
                  onChange={(e) =>
                    setVariantForm((prev) => ({ ...prev, sku: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* Two Column Grid: Thickness & Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Thickness
                  </label>
                  <input
                    id="variant-thickness-input"
                    type="number"
                    step="0.01"
                    placeholder="1.25"
                    value={variantForm.thickness}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        thickness: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Size
                  </label>
                  <input
                    id="variant-size-input"
                    type="text"
                    placeholder="XL"
                    value={variantForm.size}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, size: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddVariantOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="save-variant-submit-btn"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold px-4 py-2 rounded-lg text-xs md:text-sm transition-colors shadow-sm cursor-pointer"
                >
                  Save Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Product Variant */}
      {isEditVariantOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsEditVariantOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Edit Product Variant
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Update the variant attributes and specifications.
            </p>

            <form onSubmit={handleUpdateVariant} className="mt-5 space-y-4">
              {/* Origin Select */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Origin
                </label>
                <select
                  value={variantForm.origin}
                  onChange={(e) =>
                    setVariantForm((prev) => ({
                      ...prev,
                      origin: e.target.value as ProductOrigin | 'NONE',
                    }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                >
                  <option value="NONE">None</option>
                  <option value="LOCAL">LOCAL</option>
                  <option value="IMPORTED">IMPORTED</option>
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Color
                </label>
                <input
                  type="text"
                  value={variantForm.color}
                  onChange={(e) =>
                    setVariantForm((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  SKU
                </label>
                <input
                  type="text"
                  value={variantForm.sku}
                  onChange={(e) =>
                    setVariantForm((prev) => ({ ...prev, sku: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* Two Column Grid: Thickness & Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Thickness
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={variantForm.thickness}
                    onChange={(e) =>
                      setVariantForm((prev) => ({
                        ...prev,
                        thickness: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Size
                  </label>
                  <input
                    type="text"
                    value={variantForm.size}
                    onChange={(e) =>
                      setVariantForm((prev) => ({ ...prev, size: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditVariantOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold px-4 py-2 rounded-lg text-xs md:text-sm transition-colors shadow-sm cursor-pointer"
                >
                  Update Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Import JSON */}
      {isImportJsonOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0e0e11] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsImportJsonOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <FileJsonIcon className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Import Products JSON
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Bulk upload master products and optional nested variants atomically
              inside a single transaction (up to 250 items).
            </p>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Supports simple products or products with nested variants.
              </span>
              <button
                type="button"
                onClick={loadSampleJson}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                Load Sample JSON
              </button>
            </div>

            <form onSubmit={handleImportJson} className="mt-3 space-y-4">
              <div>
                <textarea
                  id="import-json-textarea"
                  rows={10}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder={`[\n  {\n    "name": "Curtain Wall Profile 50",\n    "unit": "METER",\n    "variants": [\n      { "sku": "CW-50-BRZ", "color": "Bronze", "origin": "IMPORTED", "thickness": 1.5 }\n    ]\n  }\n]`}
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl font-mono text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>

              {/* Live JSON Syntax Validation Status */}
              {jsonSyntaxError ? (
                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircleIcon className="w-4 h-4 shrink-0" />
                  <span>Syntax error: {jsonSyntaxError}</span>
                </div>
              ) : validatedJsonItems ? (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircleIcon className="w-4 h-4 shrink-0" />
                  <span>
                    Valid JSON: {validatedJsonItems.length} product(s) ready for
                    atomic import.
                  </span>
                </div>
              ) : null}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsImportJsonOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="import-json-submit-btn"
                  disabled={!validatedJsonItems || validatedJsonItems.length === 0}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 disabled:opacity-40 font-semibold px-4 py-2 rounded-lg text-xs md:text-sm transition-colors shadow-sm cursor-pointer"
                >
                  Import Products
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
