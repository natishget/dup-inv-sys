'use client';

import React from 'react';
import { SalesDocumentData } from '@/types/sales';
import { XIcon } from '@/components/icons';

interface SalesDocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  data: SalesDocumentData | null;
}

export function SalesDocumentViewer({
  isOpen,
  onClose,
  data,
}: SalesDocumentViewerProps) {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const fmt = (num: number) =>
    num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      {/* Container with print-specific styles */}
      <div className="relative w-full max-w-3xl bg-white text-zinc-900 rounded-2xl shadow-2xl overflow-hidden my-8 print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Top Control Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-100 border-b border-zinc-200 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-zinc-800">
              {data.type === 'QUOTATION' ? 'Quotation Preview' : 'Invoice Preview'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-200 text-zinc-700">
              {data.documentNo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="p-8 sm:p-12 print:p-8 bg-white min-h-[700px] flex flex-col justify-between" id="printable-sales-document">
          <div>
            {/* Document Header */}
            <div className="flex items-start justify-between border-b border-zinc-100 pb-8">
              {/* Left: Company Logo & Details */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-bold text-lg tracking-wider shadow-sm shrink-0">
                  KA
                </div>
                <div className="pt-1">
                  <div className="text-sm font-semibold text-zinc-900">
                    Piassa Atikelet Tera
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5">
                    +25173840930
                  </div>
                </div>
              </div>

              {/* Right: Document Identification */}
              <div className="text-right">
                <h1 className="text-2xl font-black tracking-wider text-[#0f172a] uppercase">
                  {data.type}
                </h1>
                <div className="text-xs font-medium text-zinc-500 mt-0.5">
                  {data.subtitle}
                </div>
                <div className="text-xs text-zinc-700 mt-1">
                  Document No: <span className="font-medium text-zinc-900">{data.documentNo}</span>
                </div>
                <div className="text-xs text-zinc-700 mt-0.5">
                  Date: <span className="font-medium text-zinc-900">{data.date}</span>
                </div>
              </div>
            </div>

            {/* Bill To & Notes */}
            <div className="mt-6 space-y-4">
              <div>
                <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Bill To
                </div>
                <div className="text-sm text-zinc-800 font-medium mt-0.5">
                  {data.customerName || 'Walk-in Customer'}
                </div>
              </div>

              {data.notes && (
                <div>
                  <div className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    Notes
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5 whitespace-pre-line leading-relaxed">
                    {data.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mt-8 border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#0f172a] text-white">
                    <th className="py-3 px-4 font-semibold">Item</th>
                    <th className="py-3 px-4 font-semibold text-center w-20">Qty</th>
                    <th className="py-3 px-4 font-semibold text-right w-28">Unit Price</th>
                    <th className="py-3 px-4 font-semibold text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {data.items.map((row, idx) => {
                    const parts = [
                      row.name,
                      row.sku ? row.sku : null,
                      row.color ? row.color : null,
                      row.origin ? row.origin : null,
                      row.size ? row.size : null,
                    ].filter(Boolean);

                    const label = parts.join(' · ');

                    return (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="py-3.5 px-4 font-medium text-zinc-800">
                          {label}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-zinc-700">
                          {row.quantity}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-zinc-700">
                          {fmt(row.unitPrice)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-semibold text-zinc-900">
                          {fmt(row.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Card */}
            <div className="mt-6 flex justify-end">
              <div className="w-72 bg-[#f8fafc] border border-zinc-200/90 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-zinc-800">{fmt(data.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-zinc-600">
                  <span>Tax</span>
                  <span className="font-medium text-zinc-800">
                    {fmt(data.taxAmount)} ({(data.taxRate * 100).toFixed(2)}%)
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-200 flex justify-between items-center text-sm font-extrabold text-[#0f172a]">
                  <span>Grand Total</span>
                  <span>{fmt(data.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Document Footer */}
          <div className="mt-12 pt-4 border-t border-zinc-100 text-xs text-zinc-400">
            Thank you for your business.
          </div>
        </div>
      </div>
    </div>
  );
}
