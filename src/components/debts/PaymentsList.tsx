import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  onEdit: (payment: DebtPaymentRecord) => void;
  onViewTransaction: (payment: DebtPaymentRecord) => void;
  deletingId?: string | null;
}

function PaymentItem({
  payment,
  onDelete,
  onEdit,
  onViewTransaction,
  isDeleting,
}: {
  payment: DebtPaymentRecord;
  onDelete: (payment: DebtPaymentRecord) => void;
  onEdit: (payment: DebtPaymentRecord) => void;
  onViewTransaction: (payment: DebtPaymentRecord) => void;
  isDeleting: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handler = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const amountLabel = currencyFormatter.format(payment.amount ?? 0);
  const dateLabel = payment.date ? dateFormatter.format(new Date(payment.date)) : '-';

  return (
    <li className="relative flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-border/70 bg-surface-1/80 px-4 py-3 shadow-sm">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-text">{amountLabel}</p>
          {payment.transaction_id ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
              +Transaksi &amp; Saldo
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted">{dateLabel}</p>
        {payment.account_name ? (
          <p className="text-xs text-muted">Akun: {payment.account_name}</p>
        ) : null}
        {payment.notes ? (
          <p className="mt-2 break-words text-sm text-text/80" title={payment.notes}>
            {payment.notes}
          </p>
        ) : null}
      </div>
      <div className="relative flex flex-shrink-0 items-center" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          aria-label="Menu tindakan pembayaran"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-10 z-10 w-48 rounded-xl border border-border/60 bg-surface-alt/90 p-1 text-sm text-text shadow-lg">
            {payment.transaction_id ? (
              <button
                type="button"
                onClick={() => {
                  onViewTransaction(payment);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-border/60"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Lihat transaksi
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onEdit(payment);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-border/60"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit pembayaran
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(payment);
                setMenuOpen(false);
              }}
              disabled={isDeleting}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Hapus pembayaran
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function PaymentsList({ payments, onDelete, onEdit, onViewTransaction, deletingId }: PaymentsListProps) {
  if (!payments.length) {
    return <p className="rounded-2xl border border-dashed border-border/70 bg-surface-1/40 px-4 py-6 text-center text-sm text-muted">Belum ada pembayaran tercatat.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {payments.map((payment) => (
        <PaymentItem
          key={payment.id}
          payment={payment}
          onDelete={onDelete}
          onEdit={onEdit}
          onViewTransaction={onViewTransaction}
          isDeleting={deletingId === payment.id}
        />
      ))}
    </ul>
  );
}
