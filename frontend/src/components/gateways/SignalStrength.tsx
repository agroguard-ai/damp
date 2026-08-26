'use client';

// Item 4.3 del análisis UX/UI: indicador visual de señal LoRa (RSSI/SNR), tipo "barras de
// celular", en vez de mostrar el RSSI crudo en texto plano. Usa datos reales
// (Gateway.lastRssi/lastSnr, ya persistidos por el heartbeat de telemetría) — no hay
// indicador de batería porque el collar no tiene ese dato en el modelo (ver Collar en
// schema.prisma), inventarlo hubiera sido mostrar un número que no significa nada.

interface SignalStrengthProps {
  rssi: number | null | undefined;
  snr?: number | null;
}

// Umbrales típicos para LoRa (dBm): valores más altos (menos negativos) = mejor señal.
function barsForRssi(rssi: number): number {
  if (rssi >= -70) return 4;
  if (rssi >= -85) return 3;
  if (rssi >= -100) return 2;
  return 1;
}

export function SignalStrength({ rssi, snr }: SignalStrengthProps) {
  if (rssi === null || rssi === undefined) {
    return <span className="text-zinc-400 text-[11px]">Sin señal registrada</span>;
  }

  const activeBars = barsForRssi(rssi);

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`RSSI: ${rssi} dBm${snr !== null && snr !== undefined ? ` · SNR: ${snr} dB` : ''}`}
    >
      <span className="flex items-end gap-0.5 h-3">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`w-1 rounded-sm ${bar <= activeBars ? 'bg-green-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
            style={{ height: `${bar * 25}%` }}
          />
        ))}
      </span>
      <span className="text-[11px] text-zinc-450 dark:text-zinc-500 font-mono">{rssi} dBm</span>
    </span>
  );
}
