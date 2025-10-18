import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

type ToastVariant = 'default' | 'success' | 'warning' | 'error';

export type ToastMessage = {
  id?: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  pushToast: (toast: ToastMessage) => void;
  dismissToast: (id: string) => void;
  toasts: ToastMessage[];
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const variantStyles: Record<ToastVariant, string> = {
  default: 'border-slate-200 bg-white text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700'
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((toast: ToastMessage) => {
    setToasts((current) => [
      ...current,
      {
        ...toast,
        id: toast.id ?? crypto.randomUUID(),
        variant: toast.variant ?? 'default',
        duration: toast.duration ?? 4000
      }
    ]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id!);
      }, toast.duration)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  const value = useMemo(() => ({ pushToast, dismissToast, toasts }), [dismissToast, pushToast, toasts]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

export const ToastViewport = () => {
  const [mounted, setMounted] = useState(false);
  const { dismissToast, toasts } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') return null;

  const portalTarget = document.body;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto w-[90vw] max-w-sm rounded-2xl border px-4 py-3 shadow-lg',
            variantStyles[toast.variant ?? 'default']
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description && <p className="text-xs text-slate-600">{toast.description}</p>}
            </div>
            <button
              className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
              onClick={() => dismissToast(toast.id!)}
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>,
    portalTarget
  );
};

