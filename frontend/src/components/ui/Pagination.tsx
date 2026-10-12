'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationMeta {
  totalItems: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}

export function Pagination({ meta, onPageChange, onLimitChange, limitOptions = [10, 25, 50] }: PaginationProps) {
  const { totalItems, page, limit, totalPages, hasNextPage, hasPrevPage } = meta;

  if (totalItems === 0) return null;

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalItems);

  // Generate page numbers range around current page
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      if (page > 3) pages.push('...');

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) pages.push('...');

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-sm">
      {/* Left side: Item count summary & Limit selector */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Mostrando <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{startItem}</strong> a{' '}
          <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{endItem}</strong> de{' '}
          <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{totalItems}</strong> resultados
        </span>

        {onLimitChange && (
          <div className="flex items-center gap-2">
            <span>Por página:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg px-2.5 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs cursor-pointer"
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Page navigation */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevPage}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Página anterior"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((p, idx) =>
          typeof p === 'number' ? (
            <button
              key={idx}
              onClick={() => onPageChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                p === page
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              {p}
            </button>
          ) : (
            <span key={idx} className="px-2 text-zinc-400 dark:text-zinc-500 font-bold select-none">
              ...
            </span>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Página siguiente"
          aria-label="Página siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
