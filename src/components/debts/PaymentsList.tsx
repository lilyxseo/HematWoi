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
        const dateLabel = payment.paid_at ? dateFormatter.format(new Date(payment.paid_at)) : '-';
        const isDeleting = deletingId === payment.id;
        const accountLabel = payment.account_name ?? 'Akun tidak diketahui';
        const isDraft = payment.sync_status === 'queued';
        const transactionNote = payment.transaction?.note ?? null;
        const transactionDeleted = Boolean(payment.transaction?.deleted_at);
        return (
          <li
            key={payment.id}
            className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-border/70 bg-surface-1/80 px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{amountLabel}</p>
              <p className="text-xs text-muted">
                {dateLabel}
                {accountLabel ? ` • ${accountLabel}` : ''}
              </p>
              {isDraft ? (
                <span className="mt-2 inline-flex items-center rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">
                  Draft offline
                </span>
              ) : null}
              {payment.note ? (
                <p className="mt-2 break-words text-sm text-text/80" title={payment.note}>
                  {payment.note}
                </p>
              ) : null}
              {transactionNote ? (
                <p className="mt-2 break-words text-xs text-muted" title={transactionNote}>
                  Transaksi: {transactionNote}
                </p>
              ) : null}
              {transactionDeleted ? (
                <p className="mt-2 text-xs font-medium text-red-600">Transaksi terkait ditandai terhapus.</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDelete(payment)}
              disabled={isDeleting}
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
