'use client';

import { useState, useRef, useEffect } from 'react';
import { ApiError } from '@/lib/api/client';

interface UseMutationState {
  loading: boolean;
  error: string | null;
}

interface UseMutationReturn<TArgs extends unknown[], TResult> extends UseMutationState {
  mutate: (...args: TArgs) => Promise<TResult | undefined>;
  reset: () => void;
}

export function useMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<TResult>
): UseMutationReturn<TArgs, TResult> {
  const [state, setState] = useState<UseMutationState>({
    loading: false,
    error: null,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutate = async (...args: TArgs): Promise<TResult | undefined> => {
    setState({ loading: true, error: null });
    try {
      const result = await mutationFn(...args);
      if (mountedRef.current) {
        setState({ loading: false, error: null });
      }
      return result;
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Error desconocido';
      if (mountedRef.current) {
        setState({ loading: false, error: message });
      }
      throw err;
    }
  };

  const reset = () => setState({ loading: false, error: null });

  return { ...state, mutate, reset };
}
