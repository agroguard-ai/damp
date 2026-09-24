'use client';

import { Layers } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export type MapLayerType = 'satellite' | 'streets' | 'topo' | 'dark';

export interface MapLayerControlProps {
  currentLayer: MapLayerType;
  onChangeLayer: (layer: MapLayerType) => void;
}

export default function MapLayerControl({ currentLayer, onChangeLayer }: MapLayerControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const layerOptions: { id: MapLayerType; label: string; description: string; badge?: string }[] = [
    {
      id: 'satellite',
      label: 'Satelital Híbrido',
      description: 'Fotografía con rutas y ciudades',
      badge: 'Recomendado',
    },
    {
      id: 'streets',
      label: 'Calles y Rutas',
      description: 'Mapa vial detallado y poblados',
      badge: 'Vial',
    },
    {
      id: 'topo',
      label: 'Topográfica',
      description: 'Relieve y curvas de nivel',
      badge: 'Líneas de nivel',
    },
    {
      id: 'dark',
      label: 'Modo Oscuro',
      description: 'Vectorial de alto contraste',
      badge: 'Dispositivos IoT',
    },
  ];

  return (
    <div ref={containerRef} className="absolute top-3 right-3 z-400">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-zinc-900/85 backdrop-blur-md hover:bg-zinc-900 text-white px-3 py-2 rounded-xl shadow-lg border border-white/15 text-xs font-semibold transition-all cursor-pointer"
        title="Cambiar capa del mapa"
      >
        <Layers className="w-4 h-4 text-green-400" />
        <span className="hidden sm:inline">Capas del Mapa</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-xl shadow-2xl p-2 space-y-1 z-450 animate-in fade-in zoom-in-95 duration-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-1">Tipo de Lienzo</p>
          {layerOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChangeLayer(opt.id);
                setIsOpen(false);
              }}
              className={`w-full text-left p-2 rounded-lg transition-all flex flex-col gap-0.5 cursor-pointer ${
                currentLayer === opt.id
                  ? 'bg-green-600/30 border border-green-500/40 text-white font-medium'
                  : 'hover:bg-zinc-800/80 text-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{opt.label}</span>
                {opt.badge && (
                  <span className="text-[9px] bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-zinc-400">
                    {opt.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400">{opt.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
