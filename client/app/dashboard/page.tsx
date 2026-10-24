'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/app-layout';
import {
  RefreshCwIcon,
  ChevronDownIcon,
  LineChartIcon,
  BarChart3Icon,
} from '@/components/icons';

export default function DashboardPage() {
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('FY 2026 / 2027');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const months = [
    'Jul 2026',
    'Aug 2026',
    'Sep 2026',
    'Oct 2026',
    'Nov 2026',
    'Dec 2026',
    'Jan 2027',
    'Feb 2027',
    'Mar 2027',
    'Apr 2027',
    'May 2027',
    'Jun 2027',
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <AppLayout breadcrumb="Dashboard">
      <div className="space-y-6">
        {/* Hero Banner (Financial Dashboard) matching Screenshots 3 & 5 */}
        <div className="rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-[#0d2a2f] via-[#092226] to-[#0a383d] border border-[#13444c]/60 shadow-lg text-white relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold tracking-widest text-[#22d3ee] uppercase">
                FINANCIAL DASHBOARD
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Revenue, COGS, and gross profit at a glance.
              </h1>
              <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
                Aggregated from stored sales, COGS entries, and posted transactions for the selected Ethiopian fiscal year.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3 shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-300 font-medium mb-1">
                  Fiscal Year
                </span>
                <div className="relative">
                  <select
                    value={selectedFiscalYear}
                    onChange={(e) => setSelectedFiscalYear(e.target.value)}
                    className="appearance-none bg-[#0a2e34]/90 border border-[#1a515a] rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                  >
                    <option value="FY 2026 / 2027">FY 2026 / 2027</option>
                    <option value="FY 2025 / 2026">FY 2025 / 2026</option>
                  </select>
                  <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                className="h-[34px] px-3 rounded-lg bg-white text-zinc-900 hover:bg-zinc-100 transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <RefreshCwIcon
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Revenue */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Revenue
              </span>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mt-2 mb-4 font-mono">
                0.00
              </div>
            </div>
            <div className="w-full h-1 bg-[#10b981] rounded-full" />
          </div>

          {/* COGS */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                COGS
              </span>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mt-2 mb-4 font-mono">
                0.00
              </div>
            </div>
            <div className="w-full h-1 bg-[#f97316] rounded-full" />
          </div>

          {/* Gross Profit */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Gross Profit
              </span>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mt-2 mb-4 font-mono">
                0.00
              </div>
            </div>
            <div className="w-full h-1 bg-[#0284c7] rounded-full" />
          </div>

          {/* Top Products */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Top Products
              </span>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mt-2 mb-4 font-mono">
                0
              </div>
            </div>
            <div className="w-full h-1 bg-[#64748b] rounded-full" />
          </div>
        </div>

        {/* 2 Bottom Row Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: 12-Month Financial Trend */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    12-Month Financial Trend
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Revenue, COGS, and gross profit for the selected Ethiopian fiscal year.
                  </p>
                </div>

                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
                >
                  <LineChartIcon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Monthly view</span>
                </button>
              </div>

              {/* Chart SVG Canvas */}
              <div className="w-full h-56 relative pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200">
                  {/* Dotted horizontal gridlines */}
                  <g stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1">
                    <line x1="35" y1="20" x2="590" y2="20" />
                    <line x1="35" y1="60" x2="590" y2="60" />
                    <line x1="35" y1="100" x2="590" y2="100" />
                    <line x1="35" y1="140" x2="590" y2="140" />
                    <line x1="35" y1="180" x2="590" y2="180" />
                  </g>

                  {/* Y-axis Labels */}
                  <g className="fill-zinc-400 text-[10px] font-mono" textAnchor="end">
                    <text x="30" y="24">1.00</text>
                    <text x="30" y="64">0.75</text>
                    <text x="30" y="104">0.50</text>
                    <text x="30" y="144">0.25</text>
                    <text x="30" y="184">0.00</text>
                  </g>

                  {/* Data Flat Lines matching screenshot (y = 180) */}
                  <line x1="35" y1="180" x2="590" y2="180" stroke="#3b82f6" strokeWidth="2" />

                  {/* Data Points on Flat Line */}
                  {months.map((_, i) => {
                    const x = 35 + (i * (590 - 35)) / 11;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy="180"
                        r="3"
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* X-axis Labels */}
              <div className="flex justify-between pl-8 pr-2 mt-2 text-[9px] sm:text-[10px] text-zinc-400 font-mono">
                {months.map((m) => (
                  <span key={m} className="truncate">{m}</span>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                <span>COGS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                <span>Gross Profit</span>
              </div>
            </div>
          </div>

          {/* Card 2: Top Product Variants */}
          <div className="bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[360px]">
            <div>
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Top Product Variants
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Highest selling variants by quantity within the selected fiscal year.
                  </p>
                </div>

                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shrink-0"
                >
                  <BarChart3Icon className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Top sellers</span>
                </button>
              </div>

              {/* Empty placeholder matching Screenshot */}
              <div className="h-48 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                No variant sales recorded yet for this fiscal period.
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
              Data synchronized with PostgreSQL audit ledger
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
