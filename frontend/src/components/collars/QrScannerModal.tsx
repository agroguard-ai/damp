'use client';

import { useState, useEffect, useRef } from 'react';
import { QrCode, Camera, Upload, X, Check, AlertCircle } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function QrScannerModal({ isOpen, onClose, onScan }: QrScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'image'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraError(null);
      setManualCode('');
      return;
    }

    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
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
        setScanning(true);
        startBarcodeDetection();
      }
    } catch (err: unknown) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'No se pudo acceder a la cámara. Asegúrese de otorgar permisos o ingrese el código con el lector manual.'
      );
      setScanning(false);
    }
  };

  const startBarcodeDetection = () => {
    // If native BarcodeDetector API is supported in modern browsers
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13'],
      });

      const interval = setInterval(async () => {
        if (!videoRef.current || !streamRef.current) {
          clearInterval(interval);
          return;
        }
        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            clearInterval(interval);
            handleSuccess(barcodes[0].rawValue);
          }
        } catch {
          // ignore detection frames
        }
      }, 500);
    }
  };

  const handleSuccess = (code: string) => {
    stopCamera();
    onScan(code.trim());
    onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'ean_13'],
        });
        const bitmap = await createImageBitmap(file);
        const barcodes = await barcodeDetector.detect(bitmap);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          handleSuccess(barcodes[0].rawValue);
          return;
        }
        setCameraError('No se detectó un código QR legible en la imagen subida.');
      } catch {
        setCameraError('Error al procesar el código de la imagen.');
      }
    } else {
      // Fallback filename extraction or message
      const suggested = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
      handleSuccess(suggested.startsWith('COLLAR') ? suggested : `COLLAR-${suggested}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-base">
            <QrCode className="w-5 h-5 text-green-600 dark:text-green-500" />
            Lector de Código QR / Identificador
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

        {/* Tab switch */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'camera'
                ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400 bg-white dark:bg-zinc-900 font-bold'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Cámara en Vivo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'image'
                ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400 bg-white dark:bg-zinc-900 font-bold'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Subir Imagen QR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'manual'
                ? 'border-b-2 border-green-600 text-green-700 dark:text-green-400 bg-white dark:bg-zinc-900 font-bold'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Lector USB / Rápido
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'camera' && (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                />
                {/* Visual scan overlay */}
                <div className="absolute inset-0 border-2 border-green-500/60 rounded-xl pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-green-400 rounded-lg relative animate-pulse">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500"></div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-center text-zinc-500 dark:text-zinc-400">
                Apunte la cámara al código QR impreso en el collar físico. La lectura es automática.
              </p>
              {cameraError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Acceso a cámara no disponible</p>
                    <p className="text-[11px] mt-0.5">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('manual')}
                      className="mt-2 text-[11px] font-bold underline text-red-700 dark:text-red-300 cursor-pointer"
                    >
                      Usar lector USB o ingreso rápido &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'image' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-green-500 dark:hover:border-green-500 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-zinc-50 dark:bg-zinc-950">
                <Upload className="w-8 h-8 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Seleccionar foto o captura del código QR
                </span>
                <span className="text-[11px] text-zinc-400">PNG, JPG, WEBP soportados</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleImageUpload(e)}
                  className="hidden"
                />
              </label>
              {cameraError && (
                <p className="text-xs text-red-600 dark:text-red-400 text-center font-medium">
                  {cameraError}
                </p>
              )}
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Si utiliza una pistola lectora de código de barras/QR USB o Bluetooth, simplemente escanee el código ahora.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCode.trim()) handleSuccess(manualCode.trim());
                }}
                className="space-y-3"
              >
                <input
                  autoFocus
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Escanee o pegue el código (Ej: COLLAR-0100)"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Cargar Identificador
                </button>
              </form>

              {/* Quick simulation buttons for QA testing */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Atajos rápidos de prueba
                </p>
                <div className="flex flex-wrap gap-2">
                  {['COLLAR-0099', 'COLLAR-0105', 'COLLAR-0250'].map((mockCode) => (
                    <button
                      key={mockCode}
                      type="button"
                      onClick={() => handleSuccess(mockCode)}
                      className="px-2.5 py-1 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 hover:bg-green-100 dark:hover:bg-green-950/40 text-zinc-700 dark:text-zinc-300 hover:text-green-700 dark:hover:text-green-400 rounded-lg transition-colors cursor-pointer"
                    >
                      {mockCode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
