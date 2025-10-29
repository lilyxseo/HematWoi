import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface PaymentDeleteOptionsDialogProps {
  open: boolean;
  loading?: boolean;
  onRollback: () => void;
  onKeep: () => void;
  onCancel: () => void;
}

export default function PaymentDeleteOptionsDialog({
  open,
  loading,
  onRollback,
  onKeep,
  onCancel,
}: PaymentDeleteOptionsDialogProps) {
  const rollbackRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    const timer = window.setTimeout(() => rollbackRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('keydown', handleKey);
      window.clearTimeout(timer);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-surface-1/95 p-6 text-text shadow-xl backdrop-blur">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Hapus pembayaran &amp; transaksi?</h2>
          <p className="text-sm text-muted">
            Pembayaran ini memiliki transaksi yang memengaruhi saldo akun. Kamu bisa menghapus keduanya sekaligus atau hanya
            menghapus pencatatan pembayaran.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <button
            ref={rollbackRef}
            type="button"
            onClick={onRollback}
            disabled={Boolean(loading)}
            className="inline-flex h-[44px] items-center justify-center rounded-2xl bg-danger text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Menghapus…' : 'Hapus &amp; kembalikan saldo'}
          </button>
          <button
            type="button"
            onClick={onKeep}
            disabled={Boolean(loading)}
            className="inline-flex h-[44px] items-center justify-center rounded-2xl border border-border bg-surface-1 text-sm font-semibold text-text transition hover:bg-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Memproses…' : 'Hapus hanya pembayaran'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={Boolean(loading)}
            className="inline-flex h-[40px] items-center justify-center rounded-xl border border-border bg-transparent text-sm font-medium text-muted transition hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Batal
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
