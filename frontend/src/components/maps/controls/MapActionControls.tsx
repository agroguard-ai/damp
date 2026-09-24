'use client';

import { Layers, Maximize2, Minimize2, LocateFixed } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { type MapLayerType } from './MapLayerControl';

export interface MapActionControlsProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
  currentLayer: MapLayerType;
  onChangeLayer: (layer: MapLayerType) => void;
  showLabels?: boolean;
  onToggleLabels?: () => void;
  /** Opcional — solo los mapas con datos que se mueven solos (tracking en vivo) lo necesitan. */
  onRecenter?: () => void;
}

export default function MapActionControls({
  targetRef,
  currentLayer,
  onChangeLayer,
  showLabels = true,
  onToggleLabels,
  onRecenter,
}: MapActionControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsLayerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFullscreen = () => {
    if (!targetRef.current) return;

    if (!document.fullscreenElement) {
      targetRef.current.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  };

  const layerOptions: { id: MapLayerType; label: string; description: string }[] = [
    {
      id: 'satellite',
      label: 'Satelital Híbrido',
      description: 'Foto satelital con rutas y ciudades',
    },
    {
      id: 'streets',
      label: 'Calles y Rutas',
      description: 'Mapa vial detallado y poblados',
    },
    {
      id: 'topo',
      label: 'Topográfica',
      description: 'Relieve y curvas de nivel',
    },
    {
      id: 'dark',
      label: 'Modo Oscuro',
      description: 'Vectorial de alto contraste',
    },
  ];

  return (
    <div ref={menuRef} className="absolute top-3 right-3 z-1000 flex flex-col gap-2.5 pointer-events-auto">
      {/* 1. Fullscreen Button (Top, Round Icon Only) */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="w-10 h-10 rounded-full bg-zinc-900/90 backdrop-blur-md hover:bg-zinc-800 text-white border border-zinc-700/70 shadow-xl flex items-center justify-center transition-all cursor-pointer active:scale-95"
        title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-5 h-5 text-green-400" />
        ) : (
          <Maximize2 className="w-5 h-5 text-zinc-200" />
        )}
      </button>

      {/* 2. Recenter Button — vuelve a encuadrar el mapa alrededor de la hacienda/cerco actual */}
      {onRecenter && (
        <button
          type="button"
          onClick={onRecenter}
          className="w-10 h-10 rounded-full bg-zinc-900/90 backdrop-blur-md hover:bg-zinc-800 text-white border border-zinc-700/70 shadow-xl flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Centrar mapa en la hacienda"
        >
          <LocateFixed className="w-5 h-5 text-green-400" />
        </button>
      )}

      {/* 3. Layer Switcher Button (Bottom, Round Icon Only) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsLayerMenuOpen((prev) => !prev)}
          className={`w-10 h-10 rounded-full bg-zinc-900/90 backdrop-blur-md hover:bg-zinc-800 border shadow-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            isLayerMenuOpen
              ? 'border-green-500 text-green-400 ring-2 ring-green-500/30'
              : 'border-zinc-700/70 text-zinc-200'
          }`}
          title="Capas del mapa"
        >
          <Layers className="w-5 h-5 text-green-400" />
        </button>

        {/* Floating Layer Dropdown Menu (Positioned to the left of the button) */}
        {isLayerMenuOpen && (
          <div className="absolute right-12 top-0 w-64 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-xl shadow-2xl p-2.5 space-y-1.5 z-1050 animate-in fade-in zoom-in-95 duration-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2 py-0.5">Capa de Fondo</p>
            <div className="space-y-1">
              {layerOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChangeLayer(opt.id);
                    setIsLayerMenuOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-all flex flex-col gap-0.5 cursor-pointer ${
                    currentLayer === opt.id
                      ? 'bg-green-600/30 border border-green-500/40 text-white font-medium'
                      : 'hover:bg-zinc-800/80 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400">{opt.description}</span>
                </button>
              ))}
            </div>

            {/* Toggle Overlay for City and Road Names */}
            {onToggleLabels && (
              <div className="pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={onToggleLabels}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/80 text-zinc-300 text-xs cursor-pointer transition-colors"
                  title="Mostrar u ocultar nombres de ciudades, rutas y accesos"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-white">Rutas y Poblados</span>
                    <span className="text-[10px] text-zinc-400">Capa de referencia</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                      showLabels
                        ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                    }`}
                  >
                    {showLabels ? 'Activado' : 'Oculto'}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
