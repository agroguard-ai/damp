'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UsePaginationOptions, UsePaginationReturn } from '@/types/pagination';

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { totalItems = 0, initialPage = 1, initialLimit = 10, syncUrl = true } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlPage = searchParams?.get('page');
  const urlLimit = searchParams?.get('limit');

  const page = useMemo(() => {
    if (syncUrl && urlPage) {
      const parsed = parseInt(urlPage, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return initialPage;
  }, [syncUrl, urlPage, initialPage]);

  const limit = useMemo(() => {
    if (syncUrl && urlLimit) {
      const parsed = parseInt(urlLimit, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return initialLimit;
  }, [syncUrl, urlLimit, initialLimit]);

  const totalPages = useMemo(() => {
    if (totalItems <= 0) return 0;
    return Math.ceil(totalItems / limit);
  }, [totalItems, limit]);

  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const startIndex = useMemo(() => {
    if (totalItems === 0) return 0;
    return (page - 1) * limit + 1;
  }, [page, limit, totalItems]);

  const endIndex = useMemo(() => {
    if (totalItems === 0) return 0;
    return Math.min(page * limit, totalItems);
  }, [page, limit, totalItems]);

  const updateUrl = useCallback(
    (newPage: number, newLimit: number) => {
      if (!syncUrl || !searchParams) return;

      const params = new URLSearchParams(searchParams.toString());
      params.set('page', newPage.toString());
      params.set('limit', newLimit.toString());

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [syncUrl, searchParams, pathname, router]
  );

  const goToPage = useCallback(
    (targetPage: number) => {
      const validPage = Math.max(1, Math.min(targetPage, totalPages || 1));
      updateUrl(validPage, limit);
    },
    [totalPages, updateUrl, limit]
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      goToPage(page + 1);
    }
  }, [hasNextPage, goToPage, page]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      goToPage(page - 1);
    }
  }, [hasPrevPage, goToPage, page]);

  const setLimit = useCallback(
    (newLimit: number) => {
      if (newLimit > 0) {
        updateUrl(1, newLimit);
      }
    },
    [updateUrl]
  );

  return {
    page,
    limit,
    totalPages,
    totalItems,
    hasNextPage,
    hasPrevPage,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    setLimit,
  };
}
