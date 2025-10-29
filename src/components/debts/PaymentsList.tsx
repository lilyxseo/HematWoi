import { useEffect, useState } from 'react';
import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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
  onViewTransaction?: (payment: DebtPaymentRecord) => void;
  onEdit?: (payment: DebtPaymentRecord) => void;
  deletingId?: string | null;
}

export default function PaymentsList({
  payments,
  onDelete,
  onViewTransaction,
  onEdit,
  deletingId,
}: PaymentsListProps) {
  if (!payments.length) {
    return <p className="rounded-2xl border border-dashed border-border/70 bg-surface-1/40 px-4 py-6 text-center text-sm text-muted">Belum ada pembayaran tercatat.</p>;
  }

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-payment-menu]')) {
        setOpenMenuId(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenuId]);

  return (
    <ul className="flex flex-col gap-3">
      {payments.map((payment) => {
        const amountLabel = currencyFormatter.format(payment.amount ?? 0);
        const dateLabel = payment.date ? dateFormatter.format(new Date(payment.date)) : '-';
        const isDeleting = deletingId === payment.id;
        const menuOpen = openMenuId === payment.id;
        return (
          <li key={payment.id} className="rounded-2xl border border-border/70 bg-surface-1/80 px-4 py-3 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">{amountLabel}</p>
                <p className="text-xs text-muted">{dateLabel}</p>
                {payment.account_name ? (
                  <p className="mt-1 text-xs text-muted">Akun: {payment.account_name}</p>
                ) : null}
                {payment.notes ? (
                  <p className="mt-2 break-words text-sm text-text/80" title={payment.notes}>
                    {payment.notes}
                  </p>
                ) : null}
                {payment.has_transaction ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                    +Transaksi &amp; Saldo
                  </span>
                ) : null}
              </div>
              <div className="relative" data-payment-menu="true">
                <button
                  type="button"
                  onClick={() => setOpenMenuId(menuOpen ? null : payment.id)}
                  disabled={isDeleting}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Menu pembayaran"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-border/70 bg-surface-1 shadow-xl">
                    {payment.transaction_id && onViewTransaction ? (
                      <button
                        type="button"
                        onClick={() => {
                          onViewTransaction(payment);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition hover:bg-border/40"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        Lihat transaksi
                      </button>
                    ) : null}
                    {onEdit ? (
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(payment);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition hover:bg-border/40"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit pembayaran
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        onDelete(payment);
                      }}
                      disabled={isDeleting}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Hapus pembayaran
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
