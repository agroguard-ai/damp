'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { QrCode, X, AlertCircle, Loader2, RefreshCw, Camera, Keyboard } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

interface CameraDevice {
  deviceId: string;
  label: string;
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]>;
};
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

/** Chrome/Edge lo exponen en window (en desktop no siempre); Firefox y Safari nunca. */
function getBarcodeDetectorCtor(): BarcodeDetectorCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

type QrDecoder = (video: HTMLVideoElement) => Promise<string | null>;

/** Ancho al que se reescala el frame antes de decodificar: suficiente para un QR y mucho más rápido. */
const DECODE_MAX_WIDTH = 720;

/**
 * Devuelve el mejor decodificador disponible:
 * 1. BarcodeDetector nativo (rápido) si el navegador lo trae.
 * 2. jsQR (JS puro, funciona en cualquier navegador) como fallback.
 *
 * La API nativa NO está disponible en Chrome de escritorio por defecto, así que en la
 * práctica este fallback es el camino normal.
 */
async function createDecoder(): Promise<QrDecoder> {
  const Native = getBarcodeDetectorCtor();
  if (Native) {
    try {
      const native = new Native({ formats: ['qr_code', 'code_128', 'ean_13'] });
      return async (video) => {
        const codes = await native.detect(video);
        return codes?.[0]?.rawValue ?? null;
      };
    } catch {
      /* formato no soportado: seguimos con jsQR */
    }
  }

  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  /** Recorta una región del frame, la reescala y la decodifica. */
  const decodeRegion = (
    video: HTMLVideoElement,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number
  ): string | null => {
    if (!ctx) return null;

    const scale = Math.min(1, DECODE_MAX_WIDTH / sourceWidth);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    const frame = ctx.getImageData(0, 0, width, height);
    return jsQR(frame.data, width, height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };

  return async (video) => {
    if (!ctx || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;

    const { videoWidth, videoHeight } = video;

    // 1) Recorte central (donde apunta el usuario), a resolución nativa -> más píxeles por módulo.
    const side = Math.min(videoWidth, videoHeight) * 0.7;
    const center = decodeRegion(video, (videoWidth - side) / 2, (videoHeight - side) / 2, side, side);
    if (center) return center;

    // 2) Frame completo reescalado, por si el QR quedó fuera del centro.
    return decodeRegion(video, 0, 0, videoWidth, videoHeight);
  };
}

const CAMERA_STORAGE_KEY = 'agroguard.qr.camera';
/** Tiempo máximo que esperamos a que la cámara entregue el primer frame antes de seguir igual. */
const VIDEO_READY_TIMEOUT_MS = 12000;
const DETECT_INTERVAL_MS = 350;

/** Traduce los errores de getUserMedia (que vienen en inglés) a algo accionable. */
function describeCameraError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Permiso de cámara denegado. Habilitalo desde el candado de la barra de direcciones y reintentá.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No se encontró ninguna cámara conectada.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'La cámara está siendo usada por otra aplicación o tardó demasiado en iniciar. Cerrala en la otra app y reintentá.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'La cámara elegida no está disponible. Probá con otra del listado.';
    case 'NotSupportedError':
      return 'Este navegador no permite acceder a la cámara.';
    case 'AbortError':
      return 'La cámara se interrumpió al iniciar. Reintentá.';
    default:
      return (err as Error)?.message || 'No se pudo acceder a la cámara.';
  }
}

/** Espera a que el video tenga metadata/frames. Nunca rechaza: a los X ms sigue igual. */
function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('loadedmetadata', finish);
      video.removeEventListener('canplay', finish);
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(finish, VIDEO_READY_TIMEOUT_MS);
    video.addEventListener('loadedmetadata', finish);
    video.addEventListener('canplay', finish);
  });
}

function readStoredCamera(): string {
  try {
    return localStorage.getItem(CAMERA_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeCamera(deviceId: string) {
  try {
    if (deviceId) localStorage.setItem(CAMERA_STORAGE_KEY, deviceId);
    else localStorage.removeItem(CAMERA_STORAGE_KEY);
  } catch {
    /* localStorage bloqueado: seguimos sin persistir */
  }
}

export function QrScannerModal({ isOpen, onClose, onScan }: QrScannerModalProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(readStoredCamera);
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [detectorUnavailable, setDetectorUnavailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Identifica la petición de cámara en curso: si cambia, la anterior queda obsoleta. */
  const requestIdRef = useRef(0);
  const detectingRef = useRef(false);
  const selectedCameraIdRef = useRef('');

  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);

  const stopDetection = useCallback(() => {
    detectingRef.current = false;
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    // Invalida cualquier getUserMedia en vuelo (cierre del modal, cambio de cámara, StrictMode)
    requestIdRef.current += 1;
    stopDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stopDetection]);

  const handleSuccess = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      // Soporta "2", "COLLAR-2", "ID:2", "https://.../2", etc.
      const match = code.match(/(\d+)/);
      const cleaned = match ? match[1] : code;
      detectingRef.current = false;
      stopCamera();
      setManualCode('');
      onScanRef.current(cleaned);
      onCloseRef.current();
    },
    [stopCamera]
  );

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const list = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Cámara ${index + 1}`,
        }));
      setCameras(list);
    } catch {
      /* sin permiso todavía: la lista queda vacía hasta poder enumerar */
    }
  }, []);

  const startDetection = useCallback(async () => {
    if (detectingRef.current) return;
    detectingRef.current = true;
    const requestId = requestIdRef.current;

    let decode: QrDecoder;
    try {
      decode = await createDecoder();
    } catch {
      // Sin decodificador (bundle roto, navegador viejo): habilitamos el ingreso manual.
      detectingRef.current = false;
      setDetectorUnavailable(true);
      return;
    }

    if (!detectingRef.current || requestId !== requestIdRef.current) return;

    // Bucle con setTimeout (no setInterval): si un frame tarda, no se encolan decodificaciones.
    const tick = async () => {
      if (!detectingRef.current || requestId !== requestIdRef.current) return;

      try {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          const raw = await decode(video);
          if (raw) {
            handleSuccess(raw);
            return;
          }
        }
      } catch {
        // frame ilegible (foco, movimiento): seguimos intentando
      }

      if (detectingRef.current) {
        scanTimerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
      }
    };

    scanTimerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
  }, [handleSuccess]);

  const startCamera = useCallback(
    async (preferredDeviceId?: string) => {
      const requestId = ++requestIdRef.current;
      const isCurrent = () => requestId === requestIdRef.current;

      setCameraError(null);
      setStatus('starting');

      const acquire = async (deviceId?: string) => {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException('getUserMedia no disponible', 'NotSupportedError');
        }
        const video: MediaTrackConstraints = {
          // Más resolución = el QR se lee mejor; si la cámara no lo soporta, negocia.
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
        };
        return navigator.mediaDevices.getUserMedia({ video, audio: false });
      };

      const fail = (err: unknown) => {
        if (!isCurrent()) return;
        stopCamera();
        setCameraError(describeCameraError(err));
        setStatus('error');
        // Aunque falle, refrescamos la lista para poder elegir otra cámara.
        void refreshDevices();
      };

      let stream: MediaStream | null = null;
      try {
        stream = await acquire(preferredDeviceId);
      } catch (err) {
        // La cámara guardada ya no existe / no acepta la restricción: reintentamos sin deviceId.
        const name = (err as { name?: string })?.name;
        if (preferredDeviceId && (name === 'OverconstrainedError' || name === 'NotFoundError')) {
          storeCamera('');
          selectedCameraIdRef.current = '';
          try {
            stream = await acquire(undefined);
          } catch (retryErr) {
            fail(retryErr);
            return;
          }
        } else {
          fail(err);
          return;
        }
      }

      // El modal se cerró o se cambió de cámara mientras el dispositivo arrancaba:
      // hay que apagar el stream o la próxima apertura falla con "cámara ocupada".
      if (!isCurrent() || !stream) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      video.srcObject = stream;

      // Cámaras lentas: esperamos metadata antes de play() para evitar AbortError.
      await waitForVideoReady(video);
      if (!isCurrent()) return;

      try {
        await video.play();
      } catch {
        // autoplay bloqueado o interrumpido: el stream igual se ve, no es un error de cámara
      }

      if (!isCurrent()) return;

      await refreshDevices();
      if (!isCurrent()) return;

      setStatus('ready');
      void startDetection();
    },
    [refreshDevices, startDetection, stopCamera]
  );

  const handleCameraChange = (deviceId: string) => {
    // El efecto de apertura se encarga de reiniciar la cámara con el nuevo deviceId.
    setSelectedCameraId(deviceId);
    storeCamera(deviceId);
  };

  const handleRetry = () => {
    stopCamera();
    void startCamera(selectedCameraIdRef.current || undefined);
  };

  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleSuccess(manualCode);
  };

  useEffect(() => {
    if (!isOpen) {
      // Al cerrar solo liberamos el hardware; el estado se reinicia al abrir.
      stopCamera();
      return;
    }

    selectedCameraIdRef.current = selectedCameraId;

    // Encender la cámara es suscribirse a un dispositivo externo: los setState de
    // `refreshDevices`/`startCamera` reflejan lo que reporta el hardware, no estado derivado.
    /* eslint-disable react-hooks/set-state-in-effect */
    void refreshDevices();
    void startCamera(selectedCameraId || undefined);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleDeviceChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      stopCamera();
    };
  }, [isOpen, selectedCameraId, refreshDevices, startCamera, stopCamera]);

  if (!isOpen) return null;

  const isStarting = status === 'starting';
  const isReady = status === 'ready';

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
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 space-y-3">
          {/* Selector de cámara */}
          {cameras.length > 0 && (
            <label className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <select
                value={cameras.some((camera) => camera.deviceId === selectedCameraId) ? selectedCameraId : ''}
                onChange={(e) => handleCameraChange(e.target.value)}
                className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">Cámara automática</option>
                {cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="relative rounded-xl overflow-hidden bg-black aspect-square flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay muted />

            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-zinc-200">
                <Loader2 className="w-6 h-6 animate-spin text-green-400" />
                <p className="text-xs font-semibold">Encendiendo cámara…</p>
                <p className="text-[10px] text-zinc-400">Puede tardar unos segundos</p>
              </div>
            )}

            {isReady && (
              <div className="absolute inset-0 border-2 border-green-500/60 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-green-400 rounded-lg relative animate-pulse">
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-green-500"></div>
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-green-500"></div>
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-green-500"></div>
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-green-500"></div>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
            Apuntá la cámara al código QR impreso en el collar. Se detectará y completará el ID automáticamente.
          </p>

          {cameraError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">No se pudo iniciar la cámara</p>
                  <p className="text-[11px] mt-0.5">{cameraError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 font-bold text-[11px] px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reintentar
              </button>
            </div>
          )}

          {detectorUnavailable && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/40 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                No se pudo iniciar el lector de QR. Recargá la página; mientras tanto podés ingresar el ID del collar
                abajo.
              </span>
            </div>
          )}

          {/* Fallback manual: sirve si el QR está gastado o el navegador no soporta detección */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <Keyboard className="w-3.5 h-3.5" />
              ¿No lee el QR? Ingresá el ID manualmente
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                inputMode="numeric"
                placeholder="Ej.: 2"
                className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Usar ID
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg cursor-pointer"
          >
            Cerrar Cámara
          </button>
        </div>
      </div>
    </div>
  );
}
