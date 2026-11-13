'use client';

import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';

interface CoordInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onCommit: (next: number) => void;
}

function CoordInput({ label, value, min, max, disabled, onCommit }: CoordInputProps) {
  const formatted = Number.isFinite(value) ? value.toFixed(6) : '';
  const [text, setText] = useState(formatted);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(Number.isFinite(value) ? value.toFixed(6) : '');
    }
  }, [value, focused]);

  const handleChange = (raw: string) => {
    setText(raw);
    const parsed = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      onCommit(parsed);
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setText(Number.isFinite(value) ? value.toFixed(6) : '');
    } else {
      const rounded = Number(parsed.toFixed(6));
      setText(rounded.toFixed(6));
      if (rounded !== value) {
        onCommit(rounded);
      }
    }
  };

  return (
    <label className="flex flex-col gap-0.5 flex-1 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
      <input
        type="number"
        step="any"
        min={min}
        max={max}
        disabled={disabled}
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-[11px] font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-60"
      />
    </label>
  );
}

interface VertexListPanelProps {
  points: [number, number][];
  onChangePoints: (next: [number, number][]) => void;
  selectedVertexIndex: number | null;
  onSelectVertex: (index: number | null) => void;
  readOnly?: boolean;
  defaultCenter?: [number, number];
}

export default function VertexListPanel({
  points,
  onChangePoints,
  selectedVertexIndex,
  onSelectVertex,
  readOnly = false,
  defaultCenter = [-33.3, -61.8],
}: VertexListPanelProps) {
  const handleUpdateCoord = (index: number, coordIdx: 0 | 1, nextValue: number) => {
    const updated = points.map((pt, i) => {
      if (i !== index) return pt;
      return coordIdx === 0 ? ([nextValue, pt[1]] as [number, number]) : ([pt[0], nextValue] as [number, number]);
    });
    onChangePoints(updated);
  };

  const handleRemoveVertex = (index: number) => {
    const updated = points.filter((_, i) => i !== index);
    onChangePoints(updated);
    if (selectedVertexIndex === index) {
      onSelectVertex(null);
    } else if (selectedVertexIndex !== null && selectedVertexIndex > index) {
      onSelectVertex(selectedVertexIndex - 1);
    }
  };

  const handleAddVertex = () => {
    if (points.length >= 2) {
      const last = points[points.length - 1];
      const first = points[0];
      const mid: [number, number] = [(last[0] + first[0]) / 2, (last[1] + first[1]) / 2];
      onChangePoints([...points, mid]);
      onSelectVertex(points.length);
    } else if (points.length === 1) {
      const [lat, lng] = points[0];
      onChangePoints([...points, [lat + 0.001, lng + 0.001]]);
      onSelectVertex(points.length);
    } else {
      onChangePoints([defaultCenter]);
      onSelectVertex(0);
    }
  };

  return (
    <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/80 flex flex-col max-h-64 lg:max-h-full lg:h-full min-h-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            Vértices ({points.length})
          </h4>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Ajuste preciso de latitud y longitud
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAddVertex}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            title="Agregar nuevo vértice"
          >
            <Plus className="w-3 h-3" />
            Agregar
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {points.length === 0 ? (
          <div className="py-8 px-3 text-center text-xs text-zinc-400 italic">
            Hacé clic en el mapa o usá &quot;Agregar&quot; para marcar los vértices del campo.
          </div>
        ) : (
          points.map((pt, idx) => {
            const isSelected = selectedVertexIndex === idx;
            return (
              <div
                key={idx}
                onClick={() => onSelectVertex(isSelected ? null : idx)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 shadow-xs'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                      isSelected ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-mono ${
                        isSelected
                          ? 'bg-amber-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    Vértice #{idx + 1}
                  </span>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveVertex(idx);
                      }}
                      className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                      title={`Eliminar vértice #${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <CoordInput
                    label="Latitud"
                    value={pt[0]}
                    min={-90}
                    max={90}
                    disabled={readOnly}
                    onCommit={(val) => handleUpdateCoord(idx, 0, val)}
                  />
                  <CoordInput
                    label="Longitud"
                    value={pt[1]}
                    min={-180}
                    max={180}
                    disabled={readOnly}
                    onCommit={(val) => handleUpdateCoord(idx, 1, val)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
