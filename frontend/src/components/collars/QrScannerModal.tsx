'use client';

import { useState, useEffect, useRef } from 'react';
import { QrCode, X, AlertCircle } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function QrScannerModal({ isOpen, onClose, onScan }: QrScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleSuccess = (code: string) => {
    stopCamera();
    // Extraer número de collar si el QR viene como "2", "COLLAR-2", "ID:2", "https://.../2", etc.
    const raw = code.trim();
    const match = raw.match(/(\d+)/);
    const cleaned = match ? match[1] : raw;
    onScan(cleaned);
    onClose();
  };

  const startBarcodeDetection = () => {
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13'],
      });

      timerRef.current = setInterval(async () => {
        if (!videoRef.current || !streamRef.current) {
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }
        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleSuccess(barcodes[0].rawValue);
          }
        } catch {
          // ignore detection frames
        }
      }, 400);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('La cámara no está soportada en este navegador');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startBarcodeDetection();
      }
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'No se pudo acceder a la cámara. Asegúrese de otorgar permisos al navegador.'
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-sm">
            <QrCode className="w-4 h-4 text-green-600 dark:text-green-500" />
            Escanear QR del Collar
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Únicamente Cámara */}
        <div className="p-5 flex-1 space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />
            {/* Visual scan overlay */}
            <div className="absolute inset-0 border-2 border-green-500/60 rounded-xl pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-green-400 rounded-lg relative animate-pulse">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-green-500"></div>
                <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-green-500"></div>
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-green-500"></div>
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-green-500"></div>
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
            Apuntá la cámara al código QR impreso en el collar. Se detectará y completará el ID automáticamente.
          </p>
          {cameraError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Acceso a cámara no disponible</p>
                <p className="text-[11px] mt-0.5">{cameraError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg cursor-pointer"
          >
            Cerrar Cámara
          </button>
        </div>
      </div>
    </div>
  );
}
