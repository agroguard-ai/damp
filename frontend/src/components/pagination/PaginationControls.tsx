'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  showItemRange?: boolean;
  className?: string;
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 25, 50, 100],
  showItemRange = true,
  className = '',
}: PaginationControlsProps) {
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (page > 3) {
        pages.push('...');
      }

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  }, [page, totalPages]);

  const showingFrom = useMemo(() => {
    if (!totalItems || totalItems === 0) return 0;
    return (page - 1) * limit + 1;
  }, [page, limit, totalItems]);

  const showingTo = useMemo(() => {
    if (!totalItems || totalItems === 0) return 0;
    return Math.min(page * limit, totalItems);
  }, [page, limit, totalItems]);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm ${className}`}
    >
      {/* Item Range Indicator & Limit Selector */}
      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
        {showItemRange && totalItems !== undefined && (
          <span>
            Mostrando <strong className="font-semibold text-slate-900 dark:text-slate-100">{showingFrom}</strong> a{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">{showingTo}</strong> de{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</strong> resultados
          </span>
        )}

        {onLimitChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pagination-limit-select" className="text-xs text-slate-500 dark:text-slate-400">
              Mostrar:
            </label>
            <select
              id="pagination-limit-select"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} por pág.
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="inline-flex items-center justify-center p-2 text-slate-600 dark:text-slate-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pageNumbers.map((num, idx) => {
          if (num === '...') {
            return (
              <span key={`ellipsis-${idx}`} className="px-3 py-1 text-xs text-slate-400 dark:text-slate-500">
                ...
              </span>
            );
          }

          const isActive = num === page;

          return (
            <button
              key={num}
              type="button"
              onClick={() => onPageChange(num)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {num}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          className="inline-flex items-center justify-center p-2 text-slate-600 dark:text-slate-400 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
