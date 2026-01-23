import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { DebtPaymentRecord } from '../../lib/api-debts';
import { formatMoney } from '../../lib/format';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
});

interface PaymentDeleteDialogProps {
  open: boolean;
  payment: DebtPaymentRecord | null;
  loading?: boolean;
  onDelete: (withRollback: boolean) => void;
  onCancel: () => void;
}

export default function PaymentDeleteDialog({
  open,
  payment,
  loading,
  onDelete,
  onCancel,
}: PaymentDeleteDialogProps) {
  const deletePrimaryRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => deletePrimaryRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open || !payment) return null;

  const amountLabel = formatMoney(payment.amount ?? 0, 'IDR');
  const dateLabel = payment.date ? dateFormatter.format(new Date(payment.date)) : '-';
  const hasTransaction = Boolean(payment.transaction_id);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-surface-1/95 p-6 text-text shadow-xl backdrop-blur">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Konfirmasi</p>
            <h2 className="text-lg font-semibold">Hapus pembayaran?</h2>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface-alt/70 p-3 text-sm text-muted">
            <p className="font-semibold text-text hw-money">{amountLabel}</p>
            <p className="text-xs text-muted">{dateLabel}</p>
            {payment.account_name ? <p className="text-xs text-muted">Akun: {payment.account_name}</p> : null}
          </div>
          {hasTransaction ? (
            <p className="text-sm text-muted">
              Pembayaran ini terhubung dengan transaksi dan saldo akun. Pilih tindakan di bawah.
            </p>
          ) : (
            <p className="text-sm text-muted">Pembayaran akan dihapus dari riwayat dan perhitungan hutang.</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-[40px] items-center justify-center rounded-xl border border-border bg-surface-1 px-5 text-sm font-medium transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            Batal
          </button>
          {hasTransaction ? (
            <>
              <button
                type="button"
                onClick={() => onDelete(false)}
                disabled={Boolean(loading)}
                className="inline-flex h-[40px] items-center justify-center rounded-xl border border-border/70 bg-surface-1 px-5 text-sm font-semibold text-text transition hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hapus pembayaran saja
              </button>
              <button
                ref={deletePrimaryRef}
                type="button"
                onClick={() => onDelete(true)}
                disabled={Boolean(loading)}
                className="inline-flex h-[40px] items-center justify-center rounded-xl bg-danger px-5 text-sm font-semibold text-brand-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Memproses…' : 'Hapus & rollback'}
              </button>
            </>
          ) : (
            <button
              ref={deletePrimaryRef}
              type="button"
              onClick={() => onDelete(false)}
              disabled={Boolean(loading)}
              className="inline-flex h-[40px] items-center justify-center rounded-xl bg-danger px-5 text-sm font-semibold text-brand-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Memproses…' : 'Hapus pembayaran'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
