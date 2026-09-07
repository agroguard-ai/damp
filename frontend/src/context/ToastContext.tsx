'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, description?: string, duration?: number) => void;
    error: (message: string, description?: string, duration?: number) => void;
    warning: (message: string, description?: string, duration?: number) => void;
    info: (message: string, description?: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const ToastItem = ({ toast, onClose }: ToastItemProps) => {
  const { type, message, description, duration = 4000 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Styling and configuration based on toast type
  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />,
      progressBarClass: 'bg-green-500 dark:bg-green-400',
      borderClass: 'border-green-100 dark:border-green-900/50',
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />,
      progressBarClass: 'bg-red-500 dark:bg-red-400',
      borderClass: 'border-red-100 dark:border-red-900/50',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
      progressBarClass: 'bg-amber-500 dark:bg-amber-400',
      borderClass: 'border-amber-100 dark:border-amber-900/50',
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />,
      progressBarClass: 'bg-blue-500 dark:bg-blue-400',
      borderClass: 'border-blue-100 dark:border-blue-900/50',
    },
  }[type];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-4 shadow-lg transition-all duration-300 pointer-events-auto flex items-start gap-3 animate-toast-slide-in ${config.borderClass}`}
      role="alert"
    >
      {config.icon}
      <div className="flex-1 space-y-1">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white leading-tight">{message}</h4>
        {description && <p className="text-xs text-zinc-505 dark:text-zinc-400 leading-normal">{description}</p>}
      </div>
      <button
        onClick={onClose}
        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-zinc-100 dark:bg-zinc-800/50">
        <div
          className={`h-full ${config.progressBarClass}`}
          style={{
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
};

// ToastProvider Component
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, description?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, description, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastApi = React.useMemo(
    () => ({
      toast: {
        success: (msg: string, desc?: string, dur?: number) => addToast('success', msg, desc, dur),
        error: (msg: string, desc?: string, dur?: number) => addToast('error', msg, desc, dur),
        warning: (msg: string, desc?: string, dur?: number) => addToast('warning', msg, desc, dur),
        info: (msg: string, desc?: string, dur?: number) => addToast('info', msg, desc, dur),
      },
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      {/* Toast Overlay */}
      <div className="fixed top-4 right-4 z-99999 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      {/* Inject custom CSS */}
      <style jsx global>{`
        @keyframes toast-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-toast-slide-in {
          animation: toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
};
