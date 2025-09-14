import { useEffect, useState } from 'react';

const colors = {
  info: 'border-blue-500',
  success: 'border-green-500',
  warning: 'border-amber-500',
  danger: 'border-red-500',
};

function ToastItem({ toast, onDismiss }) {
  const [show, setShow] = useState(false);

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
      <div className="flex-1 text-sm">{toast.message}</div>
      <button
        type="button"
        className="text-sm"
        onClick={() => onDismiss(toast.id)}
      >
        &times;
      </button>
    </div>
  );
}

export default function Toast({ toasts = [], onDismiss }) {
  return (
    <div className="fixed top-4 right-4 space-y-2 z-50">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
