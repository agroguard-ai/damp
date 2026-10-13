/** Nombres para mostrar de los eventos que predice el modelo de salud. */
export const EVENT_NAMES: Record<string, string> = {
  fiebre: 'Fiebre',
  celo: 'Celo',
  inactividad: 'Inactividad',
  anomalia: 'Anomalía',
};

/** Orden fijo de los eventos en gráficos y listados. */
export const EVENT_ORDER = ['fiebre', 'celo', 'inactividad', 'anomalia'] as const;
