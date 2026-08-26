// Item 5.2 del análisis UX/UI: "Skeleton Screens en lugar de Spinners... reduce la
// percepción de latencia y evita saltos de layout (CLS)". Bloque base pulsante +
// variantes compuestas para los patrones de carga más comunes de la app.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded ${className}`} />;
}

/** Tarjeta tipo animal/zona/gateway — header + un par de filas de datos. */
export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2.5 border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
    </div>
  );
}

/** Grilla de N tarjetas — reemplazo directo del spinner centrado en listados tipo cards. */
export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Fila tipo lista (gateways, collares, cercos) — ícono/nombre a la izquierda, acción a la derecha. */
export function SkeletonRow() {
  return (
    <div className="flex justify-between items-center border border-zinc-100 dark:border-zinc-800 rounded-lg p-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export function SkeletonRowList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
