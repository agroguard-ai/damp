'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from '@/lib/api/client';

interface UseApiState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => void;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: undefined,
    loading: true,
    error: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  /* eslint-disable */
  const execute = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetcherRef
      .current()
      .then((data) => {
        if (mountedRef.current) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err: unknown) => {
        if (mountedRef.current) {
          const message =
            err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error desconocido';
          setState((prev) => ({ ...prev, loading: false, error: message }));
        }
      });
  }, deps);
  /* eslint-enable */

  useEffect(() => {
    execute();
  }, [execute]);

  return { ...state, refetch: execute };
}
