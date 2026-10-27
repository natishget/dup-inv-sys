'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/app-layout';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { DashboardMetricsResponse, MonthlyTrendItem } from '@/types/dashboard';
import {
  RefreshCwIcon,
  ChevronDownIcon,
  LineChartIcon,
  BarChart3Icon,
  ShoppingCartIcon,
  PurchasesIcon,
  PackageIcon,
  WarehouseIcon,
  TrendingUpIcon,
  AlertCircleIcon,
} from '@/components/icons';

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('FY 2026 / 2027');
  const [data, setData] = useState<DashboardMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chartView, setChartView] = useState<'ALL' | 'SALES_PURCHASES' | 'SALES_COGS'>('ALL');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const res = await api.get<DashboardMetricsResponse>(
        `/dashboard/metrics?fiscalYear=${encodeURIComponent(selectedFiscalYear)}`,
      );
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard metrics.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedFiscalYear]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    fetchDashboardData(false);
  }, [authLoading, isAuthenticated, fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const fmt = (num: number | undefined | null) =>
    (num ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fmtInt = (num: number | undefined | null) =>
    (num ?? 0).toLocaleString('en-US');

  // Chart calculation helpers
  const trend = data?.monthlyTrend || [];
  const maxMetricVal = Math.max(
    ...trend.map((m) => Math.max(m.revenue, m.purchases, m.cogs, m.grossProfit)),
    100,
  );
  // Round up to nearest clean step (e.g. 500, 1000, 5000, 10000)
  const power = Math.pow(10, Math.floor(Math.log10(maxMetricVal)));
  const normalized = maxMetricVal / power;
  const niceMultiplier = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const maxChartVal = niceMultiplier * power;

  const getY = (val: number) => {
    const clamped = Math.max(0, val);
    return 180 - (clamped / maxChartVal) * 155;
  };

  const getX = (idx: number) => {
    const count = Math.max(trend.length, 1);
    if (count <= 1) return 312;
    return 40 + (idx * (585 - 40)) / (count - 1);
  };

  const createLinePath = (selector: (m: MonthlyTrendItem) => number) => {
    if (trend.length === 0) return '';
    return trend
      .map((m, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(selector(m))}`)
      .join(' ');
  };

  const createAreaPath = (selector: (m: MonthlyTrendItem) => number) => {
    if (trend.length === 0) return '';
    const line = trend
      .map((m, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(selector(m))}`)
      .join(' ');
    return `${line} L ${getX(trend.length - 1)} 180 L ${getX(0)} 180 Z`;
  };

  // Hovered month details
  const activeMonthData =
    hoveredMonthIndex !== null && trend[hoveredMonthIndex]
      ? trend[hoveredMonthIndex]
      : null;

  return (
    <AppLayout breadcrumb="Dashboard">
      <div className="space-y-6">
        {/* Hero Banner (Financial Dashboard) */}
        <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-[#0d2a2f] via-[#092226] to-[#0a383d] border border-[#13444c]/60 shadow-lg text-white relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tracking-widest text-[#22d3ee] uppercase">
                  FINANCIAL DASHBOARD
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#134e48] text-teal-200 border border-[#14b8a6]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Revenue, COGS, and Purchases at a glance.
              </h1>
              <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
                Calculated from posted sales orders, purchase invoices, and FIFO costing layers for {selectedFiscalYear}.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3 shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-300 font-medium mb-1">
                  Fiscal Period
                </span>
                <div className="relative">
                  <select
                    value={selectedFiscalYear}
                    onChange={(e) => setSelectedFiscalYear(e.target.value)}
                    className="appearance-none bg-[#0a2e34]/90 border border-[#1a515a] rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer shadow-sm"
                  >
                    <option value="FY 2026 / 2027">FY 2026 / 2027</option>
                    <option value="FY 2025 / 2026">FY 2025 / 2026</option>
                    <option value="FY 2024 / 2025">FY 2024 / 2025</option>
                    <option value="All Time">All Time</option>
                  </select>
                  <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-[34px] px-3.5 rounded-lg bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-75 transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <RefreshCwIcon
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Alert if Error */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-600 dark:text-rose-400 text-xs">
            <AlertCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 5 KPI Metric Cards: Total Sales, Total Purchases, COGS, Gross Profit, Inventory Valuation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* 1. Total Sales */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all hover:border-emerald-500/40">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <ShoppingCartIcon className="w-4 h-4 text-[#10b981]" />
                  Total Sales
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Revenue
                </span>
              </div>
              <div className="text-2xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-3 font-mono">
                {isLoading ? (
                  <span className="inline-block w-24 h-7 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                ) : (
                  fmt(data?.kpis.totalSales)
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                {fmtInt(data?.kpis.salesCount)} posted orders
              </p>
            </div>
            <div className="w-full h-1 bg-[#10b981] rounded-full shadow-xs" />
          </div>

          {/* 2. Total Purchases */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all hover:border-violet-500/40">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <PurchasesIcon className="w-4 h-4 text-[#8b5cf6]" />
                  Total Purchases
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  Inbound
                </span>
              </div>
              <div className="text-2xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-3 font-mono">
                {isLoading ? (
                  <span className="inline-block w-24 h-7 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                ) : (
                  fmt(data?.kpis.totalPurchases)
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                {fmtInt(data?.kpis.purchasesCount)} invoices received
              </p>
            </div>
            <div className="w-full h-1 bg-[#8b5cf6] rounded-full shadow-xs" />
          </div>

          {/* 3. COGS */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all hover:border-orange-500/40">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <PackageIcon className="w-4 h-4 text-[#f97316]" />
                  COGS
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  Cost
                </span>
              </div>
              <div className="text-2xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-3 font-mono">
                {isLoading ? (
                  <span className="inline-block w-24 h-7 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                ) : (
                  fmt(data?.kpis.totalCogs)
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                FIFO cost of sold stock
              </p>
            </div>
            <div className="w-full h-1 bg-[#f97316] rounded-full shadow-xs" />
          </div>

          {/* 4. Gross Profit */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all hover:border-cyan-500/40">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <TrendingUpIcon className="w-4 h-4 text-[#0284c7]" />
                  Gross Profit
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    (data?.kpis.grossProfit ?? 0) >= 0
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {(data?.kpis.profitMargin ?? 0).toFixed(1)}% margin
                </span>
              </div>
              <div
                className={`text-2xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight mt-3 font-mono ${
                  (data?.kpis.grossProfit ?? 0) < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-zinc-900 dark:text-white'
                }`}
              >
                {isLoading ? (
                  <span className="inline-block w-24 h-7 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                ) : (
                  fmt(data?.kpis.grossProfit)
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                Sales minus COGS
              </p>
            </div>
            <div className="w-full h-1 bg-[#0284c7] rounded-full shadow-xs" />
          </div>

          {/* 5. Inventory Valuation */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all hover:border-slate-500/40 sm:col-span-2 lg:col-span-1">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <WarehouseIcon className="w-4 h-4 text-[#64748b]" />
                  Inventory Value
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-700 dark:text-zinc-300">
                  {data?.kpis.productsCount ?? 0} items
                </span>
              </div>
              <div className="text-2xl sm:text-2xl xl:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-3 font-mono">
                {isLoading ? (
                  <span className="inline-block w-24 h-7 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                ) : (
                  fmt(data?.kpis.totalInventoryValue)
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                {fmt(data?.kpis.totalInventoryUnits)} units in stock
              </p>
            </div>
            <div className="w-full h-1 bg-[#64748b] rounded-full shadow-xs" />
          </div>
        </div>

        {/* 2 Bottom Row Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: 12-Month Financial Trend Chart */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <LineChartIcon className="w-4 h-4 text-emerald-500" />
                    12-Month Financial Trend
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Monthly Sales, Purchases, COGS, and Gross Profit for {selectedFiscalYear}.
                  </p>
                </div>

                {/* Filter Selector */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setChartView('ALL')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      chartView === 'ALL'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('SALES_PURCHASES')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      chartView === 'SALES_PURCHASES'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Sales vs Inbound
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('SALES_COGS')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      chartView === 'SALES_COGS'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Sales vs COGS
                  </button>
                </div>
              </div>

              {/* Hovered Month Tooltip Summary */}
              {activeMonthData && (
                <div className="mb-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    {activeMonthData.month}:
                  </span>
                  <div className="flex items-center gap-4 text-[11px] font-mono">
                    <span className="text-[#10b981]">
                      Sales: {fmt(activeMonthData.revenue)}
                    </span>
                    <span className="text-[#8b5cf6]">
                      Purchases: {fmt(activeMonthData.purchases)}
                    </span>
                    <span className="text-[#f97316]">
                      COGS: {fmt(activeMonthData.cogs)}
                    </span>
                    <span className="text-[#0284c7]">
                      Profit: {fmt(activeMonthData.grossProfit)}
                    </span>
                  </div>
                </div>
              )}

              {/* Chart SVG Canvas */}
              <div className="w-full h-56 relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200">
                  {/* Dotted horizontal gridlines */}
                  <g stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1">
                    <line x1="40" y1="25" x2="585" y2="25" />
                    <line x1="40" y1="64" x2="585" y2="64" />
                    <line x1="40" y1="102" x2="585" y2="102" />
                    <line x1="40" y1="141" x2="585" y2="141" />
                    <line x1="40" y1="180" x2="585" y2="180" />
                  </g>

                  {/* Y-axis Labels */}
                  <g className="fill-zinc-400 text-[10px] font-mono" textAnchor="end">
                    <text x="35" y="28">{maxChartVal >= 1000 ? `${(maxChartVal / 1000).toFixed(0)}k` : maxChartVal}</text>
                    <text x="35" y="67">{maxChartVal >= 1000 ? `${((maxChartVal * 0.75) / 1000).toFixed(0)}k` : (maxChartVal * 0.75).toFixed(0)}</text>
                    <text x="35" y="105">{maxChartVal >= 1000 ? `${((maxChartVal * 0.5) / 1000).toFixed(0)}k` : (maxChartVal * 0.5).toFixed(0)}</text>
                    <text x="35" y="144">{maxChartVal >= 1000 ? `${((maxChartVal * 0.25) / 1000).toFixed(0)}k` : (maxChartVal * 0.25).toFixed(0)}</text>
                    <text x="35" y="184">0.00</text>
                  </g>

                  {/* Chart Areas (Light transparent fills) */}
                  {(chartView === 'ALL' || chartView === 'SALES_PURCHASES' || chartView === 'SALES_COGS') && (
                    <path
                      d={createAreaPath((m) => m.revenue)}
                      fill="#10b981"
                      fillOpacity="0.06"
                    />
                  )}

                  {/* Purchases Line */}
                  {(chartView === 'ALL' || chartView === 'SALES_PURCHASES') && (
                    <path
                      d={createLinePath((m) => m.purchases)}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* COGS Line */}
                  {(chartView === 'ALL' || chartView === 'SALES_COGS') && (
                    <path
                      d={createLinePath((m) => m.cogs)}
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Gross Profit Line */}
                  {chartView === 'ALL' && (
                    <path
                      d={createLinePath((m) => m.grossProfit)}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2"
                    />
                  )}

                  {/* Total Sales / Revenue Line (Top primary line) */}
                  <path
                    d={createLinePath((m) => m.revenue)}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                  />

                  {/* Data Points on Curves */}
                  {trend.map((m, i) => {
                    const cx = getX(i);
                    const cyRev = getY(m.revenue);
                    const isHovered = hoveredMonthIndex === i;

                    return (
                      <g
                        key={i}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredMonthIndex(i)}
                        onMouseLeave={() => setHoveredMonthIndex(null)}
                      >
                        {/* Hover bar target */}
                        <rect
                          x={cx - 15}
                          y="10"
                          width="30"
                          height="180"
                          fill="transparent"
                        />

                        {/* Point on Revenue Line */}
                        <circle
                          cx={cx}
                          cy={cyRev}
                          r={isHovered ? 5 : 3.5}
                          fill="#10b981"
                          stroke="white"
                          strokeWidth="1.5"
                          className="transition-all"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* X-axis Labels */}
              <div className="flex justify-between pl-8 pr-1 mt-2 text-[9px] sm:text-[10px] text-zinc-400 font-mono">
                {trend.map((m, i) => (
                  <span
                    key={i}
                    onMouseEnter={() => setHoveredMonthIndex(i)}
                    onMouseLeave={() => setHoveredMonthIndex(null)}
                    className={`text-center cursor-pointer transition-colors ${
                      hoveredMonthIndex === i
                        ? 'text-zinc-900 dark:text-zinc-100 font-bold underline'
                        : ''
                    }`}
                  >
                    <span className="sm:hidden">{m.shortMonth}</span>
                    <span className="hidden sm:inline">{m.month}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Total Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
                <span>Purchases</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                <span>COGS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" />
                <span>Gross Profit</span>
              </div>
            </div>
          </div>

          {/* Card 2: Top Product Variants */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[360px]">
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <BarChart3Icon className="w-4 h-4 text-cyan-500" />
                    Top Product Variants
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Highest selling product variants by units and revenue in {selectedFiscalYear}.
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 shrink-0">
                  {data?.topVariants.length ?? 0} variants
                </span>
              </div>

              {/* Variants List or Empty State */}
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <RefreshCwIcon className="w-5 h-5 animate-spin" />
                  <span className="text-xs">Computing variant metrics...</span>
                </div>
              ) : !data || data.topVariants.length === 0 ? (
                <div className="h-52 flex flex-col items-center justify-center text-xs text-zinc-400 dark:text-zinc-500 font-medium text-center p-6 gap-2">
                  <BarChart3Icon className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                  <p>No variant sales recorded yet for {selectedFiscalYear}.</p>
                  <span className="text-[11px] text-zinc-400">
                    New posted sales will automatically rank here.
                  </span>
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {data.topVariants.map((v, idx) => {
                    const topSellerUnits = data.topVariants[0]?.unitsSold || 1;
                    const pct = Math.round((v.unitsSold / topSellerUnits) * 100);

                    return (
                      <div
                        key={v.variantId}
                        className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="truncate">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate block">
                                {v.productName}
                              </span>
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {[v.sku, v.color, v.origin, v.size].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0 font-mono">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">
                              {fmt(v.revenue)}
                            </div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              {v.profitMargin.toFixed(1)}% margin
                            </div>
                          </div>
                        </div>

                        {/* Units sold & Progress bar */}
                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
                          <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden flex-1">
                            <div
                              className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(5, pct)}%` }}
                            />
                          </div>
                          <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">
                            {fmtInt(v.unitsSold)} units
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-[11px] text-zinc-400 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
              <span>Synchronized with PostgreSQL audit ledger</span>
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                ● Live Calculations
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
