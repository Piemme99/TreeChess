import { useEffect } from 'react';
import { cva } from 'class-variance-authority';
import { useToastStore } from '../../../stores/toastStore';
import type { Toast as ToastType, ToastType as ToastVariant } from '../../../types';

const toastIcon = cva('text-xl', {
  variants: {
    type: {
      success: 'text-success',
      error: 'text-danger',
      warning: 'text-warning',
      info: 'text-info',
    },
  },
});

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, removeToast]);

  const getIcon = (type: ToastVariant) => {
    switch (type) {
      case 'success':
        return '\u2713';
      case 'error':
        return '\u2715';
      case 'warning':
        return '\u26A0';
      case 'info':
        return '\u2139';
    }
  };

  return (
    <div className={`flex items-center gap-2 p-4 bg-bg-card/95 backdrop-blur-sm rounded-xl shadow-lg animate-slide-in border-l-4 ${
      toast.type === 'success' ? 'border-l-success bg-success-light/30' :
      toast.type === 'error' ? 'border-l-danger bg-danger-light/30' :
      toast.type === 'warning' ? 'border-l-warning bg-warning-light/30' :
      'border-l-info bg-info-light/30'
    }`}>
      <span className={toastIcon({ type: toast.type })}>{getIcon(toast.type)}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        className="bg-transparent border-none text-xl text-text-muted cursor-pointer"
        onClick={() => removeToast(toast.id)}
      >
        &times;
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[1100] max-w-[400px]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
