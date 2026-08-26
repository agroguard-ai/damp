'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface MapFullScreenControlProps {
  targetRef: React.RefObject<HTMLDivElement | null>;
}

export default function MapFullScreenControl({ targetRef }: MapFullScreenControlProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
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

  return (
    <div className="absolute top-3 left-3 z-400">
      <button
        type="button"
        onClick={toggleFullscreen}
        className="flex items-center gap-1.5 bg-zinc-900/85 backdrop-blur-md hover:bg-zinc-900 text-white p-2 sm:px-3 sm:py-2 rounded-xl shadow-lg border border-white/15 text-xs font-semibold transition-all cursor-pointer"
        title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 text-green-400" />
        ) : (
          <Maximize2 className="w-4 h-4 text-green-400" />
        )}
        <span className="hidden sm:inline">{isFullscreen ? 'Salir' : 'Pantalla Completa'}</span>
      </button>
    </div>
  );
}
