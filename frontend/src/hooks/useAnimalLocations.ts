'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { animalsApi } from '@/lib/api/animals';
import type { AnimalLocation } from '@/types';

const POLL_INTERVAL_MS = 30_000;
const EMPTY: AnimalLocation[] = [];

/**
 * Posiciones de la hacienda de un campo. Solo consulta (y refresca cada 30 s)
 * mientras `enabled` está en true: con la capa apagada no se hace ningún request.
 */
export function useAnimalLocations(farmId: string | null | undefined, enabled: boolean) {
  const fetcher = useCallback(async () => {
    if (!farmId || !enabled) return { animals: EMPTY, fetchedAt: 0 };
    // Hora de la consulta: sirve de referencia para marcar señales desactualizadas
    const fetchedAt = Date.now();
    const animals = await animalsApi.getLocations(farmId);
    return { animals, fetchedAt };
  }, [farmId, enabled]);

  const { data, loading, refetch } = useApi(fetcher, [farmId, enabled]);

  useEffect(() => {
    if (!farmId || !enabled) return;
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [farmId, enabled, refetch]);

  return {
    animals: data?.animals ?? EMPTY,
    fetchedAt: data?.fetchedAt ?? 0,
    loading: enabled && loading,
    refetch,
  };
}

/** Estado del botón "Animales" de los mapas: arranca siempre apagado. */
export function useAnimalsToggle(farmId: string | null | undefined) {
  const [enabled, setEnabled] = useState(false);
  const locations = useAnimalLocations(farmId, enabled);
  const withGps = locations.animals.filter((a) => a.latestReading !== null).length;

  return {
    ...locations,
    enabled,
    /** Props para MapActionControls (undefined si el mapa no tiene campo asociado). */
    control: farmId
      ? { enabled, onToggle: () => setEnabled((v) => !v), count: withGps, loading: locations.loading }
      : undefined,
  };
}
