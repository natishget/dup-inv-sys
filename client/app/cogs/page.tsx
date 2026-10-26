'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/app-layout';
import { api, getAccessToken } from '@/lib/api';
import {
  CostingMethod,
  CogsReportResponse,
  CogsSummary,
  CogsVariantItem,
} from '@/types/cogs';
import {
  RefreshCwIcon,
  AlertCircleIcon,
  XIcon,
} from '@/components/icons';

// ─── Inline Download SVG Icon ────────────────────────────────────────────────
function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ─── Number Formatter Helper ─────────────────────────────────────────────────
const fmt = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num)
    ? '0.00'
    : num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

export default function CogsPage() {
  // ─── Filter States ──────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [costingMethod, setCostingMethod] = useState<CostingMethod>('FIFO');
  const [page, setPage] = useState(1);

  // ─── Data & Loading States ──────────────────────────────────────────────────
  const [report, setReport] = useState<CogsReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── 1. Initialize Dates on Mount (Prevents Next.js Prerender Issues) ────────
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
    const lastDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    )
      .toISOString()
      .slice(0, 10);

    setStartDate(firstDay);
    setEndDate(lastDay);
  }, []);

  // ─── 2. Fetch COGS Report ───────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      params.set('costingMethod', costingMethod);
      params.set('page', String(page));
      params.set('limit', '10');

      const res = await api.get<CogsReportResponse>(`/cogs/report?${params.toString()}`);
      setReport(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch COGS report.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, costingMethod, page]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ─── 3. Download CSV Export ─────────────────────────────────────────────────
  const handleDownloadCsv = async () => {
    if (!startDate || !endDate) return;

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      params.set('costingMethod', costingMethod);

      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/cogs/export-csv?${params.toString()}`,
        {
          headers,
          credentials: 'include',
        },
      );

      if (!res.ok) {
        throw new Error('Failed to generate CSV export stream.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cogs-${costingMethod}-${startDate}-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download CSV export.';
      setErrorMessage(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const activeMethod = report?.active_method || 'FIFO';
  const isSimulated = report?.is_simulated || false;
  const summary: CogsSummary = report?.summary || {
    total_revenue: 0,
    total_cogs: 0,
    total_gross_profit: 0,
    profit_margin: 0,
  };
  const items: CogsVariantItem[] = report?.data || [];
  const meta = report?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

  return (
    <AppLayout breadcrumb="COGS">
      <div className="space-y-6">
        {/* Error Alert */}
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

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              COGS Report
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Track revenue, COGS, gross profit, and margin by product variant.
            </p>
          </div>

          {/* Active Method Badge */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center px-3 py-1.5 rounded-lg border border-zinc-800 bg-[#0a0a0c] text-xs font-medium text-zinc-300 shadow-xs">
              <span className="text-zinc-500 mr-1.5">Active method:</span>
              <span className="font-semibold text-zinc-100">{activeMethod}</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          {/* Costing Method Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
              Costing Method
            </label>
            <select
              value={costingMethod}
              onChange={(e) => {
                setCostingMethod(e.target.value as CostingMethod);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
            >
              <option value="FIFO">FIFO</option>
              <option value="LIFO">LIFO</option>
              <option value="WEIGHTED_AVERAGE">Weighted Average</option>
            </select>
          </div>
        </div>

        {/* Simulation Warning Banner */}
        {isSimulated && (
          <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs leading-relaxed">
            <span className="font-semibold shrink-0">⚠️ Simulated Costing Mode:</span>
            <span>
              You are viewing an in-memory simulated <strong>{costingMethod === 'WEIGHTED_AVERAGE' ? 'Weighted Average' : costingMethod}</strong> valuation. Corporate standard remains <strong>{activeMethod}</strong>. Historical frozen ledger records are completely unchanged.
            </span>
          </div>
        )}

        {/* 3 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Revenue Card */}
          <div className="p-6 bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl space-y-2">
            <div className="text-xs font-medium text-zinc-400">Revenue</div>
            <div className="text-2xl font-bold tracking-tight text-zinc-100">
              {fmt(summary.total_revenue)}
            </div>
          </div>

          {/* COGS Card */}
          <div className="p-6 bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl space-y-2">
            <div className="text-xs font-medium text-zinc-400">COGS</div>
            <div className="text-2xl font-bold tracking-tight text-zinc-100">
              {fmt(summary.total_cogs)}
            </div>
          </div>

          {/* Gross Profit Card */}
          <div className="p-6 bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl space-y-2">
            <div className="text-xs font-medium text-zinc-400">Gross Profit</div>
            <div className="text-2xl font-bold tracking-tight text-zinc-100">
              {fmt(summary.total_gross_profit)}
            </div>
          </div>
        </div>

        {/* Table of Variants */}
        <div className="bg-[#0a0a0c] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800/80 text-zinc-400 text-[11px] uppercase tracking-wider bg-zinc-900/40">
                  <th className="py-3.5 px-4 font-semibold">Product Name</th>
                  <th className="py-3.5 px-4 font-semibold">Color</th>
                  <th className="py-3.5 px-4 font-semibold">Origin</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Quantity Sold</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Revenue</th>
                  <th className="py-3.5 px-4 font-semibold text-right">COGS</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Gross Profit</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Profit Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-zinc-500">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCwIcon className="w-4 h-4 animate-spin" />
                        <span>Calculating valuation metrics...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-zinc-500">
                      No COGS data found for this period.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.variant_id}
                      className="hover:bg-zinc-900/30 transition-colors"
                    >
                      {/* Product Name */}
                      <td className="py-4 px-4 font-medium text-zinc-100 whitespace-nowrap">
                        {item.product_name}
                      </td>

                      {/* Color */}
                      <td className="py-4 px-4 text-zinc-400 whitespace-nowrap">
                        {item.color}
                      </td>

                      {/* Origin */}
                      <td className="py-4 px-4 text-zinc-400 whitespace-nowrap">
                        {item.origin}
                      </td>

                      {/* Quantity Sold */}
                      <td className="py-4 px-4 text-center text-zinc-300 whitespace-nowrap font-medium">
                        {item.quantity_sold}
                      </td>

                      {/* Revenue */}
                      <td className="py-4 px-4 text-right text-zinc-200 whitespace-nowrap font-medium">
                        {fmt(item.revenue)}
                      </td>

                      {/* COGS */}
                      <td className="py-4 px-4 text-right text-zinc-200 whitespace-nowrap font-medium">
                        {fmt(item.cogs)}
                      </td>

                      {/* Gross Profit */}
                      <td className="py-4 px-4 text-right text-zinc-100 whitespace-nowrap font-semibold">
                        {fmt(item.gross_profit)}
                      </td>

                      {/* Profit Margin % */}
                      <td className="py-4 px-4 text-right whitespace-nowrap font-semibold text-zinc-200">
                        {item.profit_margin.toFixed(2)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Bar & Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-zinc-800/80 bg-zinc-900/20 text-xs text-zinc-400">
            <div>
              Showing {items.length > 0 ? (meta.page - 1) * 10 + 1 : 0}-
              {Math.min(meta.page * 10, meta.total)} of {meta.total}
            </div>

            <div className="flex items-center gap-2">
              {/* Download CSV */}
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={isExporting || items.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0c] hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <DownloadIcon className="w-3.5 h-3.5 text-zinc-400" />
                {isExporting ? 'Exporting...' : 'Download CSV'}
              </button>

              {/* Refresh */}
              <button
                type="button"
                onClick={fetchReport}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0c] hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCwIcon className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              {/* Previous */}
              <button
                disabled={meta.page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Previous
              </button>

              {/* Next */}
              <button
                disabled={meta.page >= meta.totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
