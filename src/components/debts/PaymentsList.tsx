import { Trash2 } from 'lucide-react';
import type { DebtPaymentRecord } from '../../lib/api-debts';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
});

interface PaymentsListProps {
  payments: DebtPaymentRecord[];
  onDelete: (payment: DebtPaymentRecord) => void;
  deletingId?: string | null;
}

export default function PaymentsList({ payments, onDelete, deletingId }: PaymentsListProps) {
  if (!payments.length) {
    return <p className="rounded-2xl border border-dashed border-border/70 bg-surface-1/40 px-4 py-6 text-center text-sm text-muted">Belum ada pembayaran tercatat.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {payments.map((payment) => {
        const amountLabel = currencyFormatter.format(payment.amount ?? 0);
        const dateLabel = payment.paid_at
          ? dateFormatter.format(new Date(`${payment.paid_at}T00:00:00`))
          : '-';
        const isDeleting = deletingId === payment.id;
        const disableDelete = isDeleting || payment.queued;
        const accountLabel = payment.account?.name ?? 'Akun tidak tersedia';
        const transaction = payment.transaction;
        const transactionTitle = transaction?.title ?? 'Transaksi otomatis';
        const transactionDeleted = Boolean(transaction?.deleted_at);
        const awaitingSync = payment.queued || !transaction;
        return (
          <li
            key={payment.id}
            className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-border/70 bg-surface-1/80 px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{amountLabel}</p>
              <p className="text-xs text-muted">{dateLabel} • {accountLabel}</p>
              {payment.note ? (
                <p className="mt-2 break-words text-sm text-text/80" title={payment.note}>
                  {payment.note}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted">
                {awaitingSync ? (
                  <span className="inline-flex items-center gap-2 text-amber-700">
                    <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                    Transaksi otomatis akan dibuat setelah sinkronisasi.
                  </span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>Transaksi otomatis:</span>
                    <span className="font-medium text-text" title={transactionTitle}>
                      {transactionTitle}
                    </span>
                    {transactionDeleted ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Dinonaktifkan
                      </span>
                    ) : null}
                  </span>
                )}
              </p>
              {payment.queued ? (
                <p className="mt-2 text-xs font-medium text-amber-700">Menunggu koneksi. Pembayaran belum tersinkron.</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDelete(payment)}
              disabled={disableDelete}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-muted transition hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Hapus pembayaran"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
