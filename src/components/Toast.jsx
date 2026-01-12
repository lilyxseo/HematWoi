import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const colors = {
  info: 'border-blue-500/60 bg-blue-500/10 text-blue-100',
  success: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-50',
  warning: 'border-amber-500/60 bg-amber-500/10 text-amber-50',
  error: 'border-rose-500/60 bg-rose-500/10 text-rose-50',
  danger: 'border-rose-500/60 bg-rose-500/10 text-rose-50',
};

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  danger: AlertCircle,
};

function ToastItem({ toast, onDismiss }) {
  const [show, setShow] = useState(false);
  const content = useMemo(() => {
    const title = toast.title ?? null;
    const message = toast.message ?? '';
    const description = toast.description ?? null;
    if (title) {
      return {
        title,
        body: description || message,
      };
    }
    return {
      title: message,
      body: description,
    };
  }, [toast.description, toast.message, toast.title]);
  const Icon = icons[toast.type] || icons.info;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`card shadow-lg p-3 flex items-start gap-2 border-l-4 ${
        colors[toast.type] || colors.info
      } transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <span className="mt-0.5 text-lg" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1 text-sm">
        <div className="font-semibold">{content.title}</div>
        {content.body ? (
          <div className="mt-1 text-xs text-slate-200/80">{content.body}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="text-sm text-slate-200/80 hover:text-white"
        onClick={() => onDismiss(toast.id)}
        aria-label="Tutup notifikasi"
      >
        &times;
      </button>
    </div>
  );
}

export default function Toast({ toasts = [], onDismiss }) {
  return (
    <div
      className="fixed right-4 space-y-2 z-50"
      style={{
        top: "calc(var(--app-header-height, var(--app-topbar-h, 0px)) + 16px)",
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
