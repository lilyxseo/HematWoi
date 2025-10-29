import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface PaymentDeleteDialogProps {
  open: boolean;
  loading?: boolean;
  withRollback: boolean;
  hasTransaction: boolean;
  onChangeRollback: (value: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PaymentDeleteDialog({
  open,
  loading,
  withRollback,
  hasTransaction,
  onChangeRollback,
  onConfirm,
  onCancel,
}: PaymentDeleteDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => confirmRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-surface-1/95 p-6 text-text shadow-xl backdrop-blur">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Hapus pembayaran?</h2>
          <p className="text-sm text-muted">
            Pembayaran akan dihapus dari riwayat dan perhitungan total akan diperbarui.
          </p>
        </div>
        {hasTransaction ? (
          <div className="mt-4 rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="font-semibold text-text">Hapus juga transaksi &amp; kembalikan saldo?</p>
                <p className="text-xs text-muted">
                  Jika diaktifkan, transaksi terkait akan dihapus dan saldo akun dipulihkan.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={withRollback}
                onClick={() => onChangeRollback(!withRollback)}
                className={clsx(
                  'flex h-9 w-16 items-center rounded-full border border-border px-1 transition',
                  withRollback ? 'justify-end bg-brand text-brand-foreground' : 'justify-start bg-surface text-muted',
                )}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow">
                  {withRollback ? <span className="text-sm font-semibold">YA</span> : <span className="text-xs font-medium">TIDAK</span>}
                </span>
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-[40px] items-center justify-center rounded-xl border border-border bg-surface-1 px-5 text-sm font-medium transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            Batal
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={Boolean(loading)}
            className="inline-flex h-[40px] items-center justify-center rounded-xl bg-danger px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Menghapus…' : 'Hapus'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
