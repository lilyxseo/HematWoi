import { Eye, Sparkles, Trash2 } from 'lucide-react';
import type { DebtPaymentRecord } from '../../lib/api-debts';
import { formatMoney } from '../../lib/format';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
});

interface PaymentsListProps {
  payments: DebtPaymentRecord[];
  onDelete: (payment: DebtPaymentRecord) => void;
  deletingId?: string | null;
  onViewTransaction?: (transactionId: string) => void;
}

export default function PaymentsList({ payments, onDelete, deletingId, onViewTransaction }: PaymentsListProps) {
  if (!payments.length) {
    return <p className="rounded-2xl border border-dashed border-border/70 bg-surface-1/40 px-4 py-6 text-center text-sm text-muted">Belum ada pembayaran tercatat.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {payments.map((payment) => {
        const amountLabel = formatMoney(payment.amount ?? 0, 'IDR');
        const dateLabel = payment.date ? dateFormatter.format(new Date(payment.date)) : '-';
        const isDeleting = deletingId === payment.id;
        return (
          <li
            key={payment.id}
            className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/70 bg-surface-1/80 px-4 py-3 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text hw-money">{amountLabel}</p>
                <p className="text-xs text-muted">{dateLabel}</p>
                {payment.account_name ? (
                  <p className="mt-1 text-xs text-muted">Akun: {payment.account_name}</p>
                ) : null}
                {payment.notes ? (
                  <p className="mt-2 break-words text-sm text-text/80" title={payment.notes}>
                    {payment.notes}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                {payment.transaction_id ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-200">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    +Transaksi &amp; Saldo
                  </span>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {payment.transaction_id && onViewTransaction ? (
                    <button
                      type="button"
                      onClick={() => onViewTransaction(payment.transaction_id as string)}
                      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface px-3 py-1.5 text-xs font-semibold text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Lihat transaksi
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDelete(payment)}
                    disabled={isDeleting}
                    className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-muted transition hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Hapus pembayaran"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
