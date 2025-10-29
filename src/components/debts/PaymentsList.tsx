import { ExternalLink, MoreVertical, Trash2 } from 'lucide-react';
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
  deletingId?: string | null;
  onViewTransaction?: (transactionId: string) => void;
}

export default function PaymentsList({ payments, onDelete, deletingId, onViewTransaction }: PaymentsListProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!activeMenu) return undefined;
    const currentId = activeMenu;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const menu = menuRefs.current.get(currentId);
      if (menu && target && !menu.contains(target)) {
        setActiveMenu(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [activeMenu]);

  if (!payments.length) {
    return <p className="rounded-2xl border border-dashed border-border/70 bg-surface-1/40 px-4 py-6 text-center text-sm text-muted">Belum ada pembayaran tercatat.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {payments.map((payment) => {
        const amountLabel = currencyFormatter.format(payment.amount ?? 0);
        const dateLabel = payment.date ? dateFormatter.format(new Date(payment.date)) : '-';
        const isDeleting = deletingId === payment.id;
        const hasTransaction = Boolean(payment.transaction_id);
        const accountLabel = payment.account_name ? `Akun: ${payment.account_name}` : null;
        const isMenuOpen = activeMenu === payment.id;
        return (
          <li
            key={payment.id}
            className="relative flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-border/70 bg-surface-1/80 px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">{amountLabel}</p>
              <p className="text-xs text-muted">{dateLabel}</p>
              {hasTransaction ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand">
                  + Transaksi &amp; Saldo
                </span>
              ) : null}
              {accountLabel ? <p className="mt-1 text-xs text-muted">{accountLabel}</p> : null}
              {payment.notes ? (
                <p className="mt-2 break-words text-sm text-text/80" title={payment.notes}>
                  {payment.notes}
                </p>
              ) : null}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveMenu((prev) => (prev === payment.id ? null : payment.id))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-label="Aksi pembayaran"
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </button>
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
            {isMenuOpen ? (
              <div
                ref={(node) => {
                  if (node) {
                    menuRefs.current.set(payment.id, node);
                  } else {
                    menuRefs.current.delete(payment.id);
                  }
                }}
                role="menu"
                className="absolute right-4 top-12 z-10 w-48 rounded-2xl border border-border/60 bg-surface-1 p-2 text-sm shadow-lg"
              >
                {hasTransaction ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-text transition hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                    onClick={() => {
                      if (onViewTransaction && payment.transaction_id) {
                        onViewTransaction(payment.transaction_id);
                      } else if (payment.transaction_id) {
                        window.open(`/transactions?highlight=${payment.transaction_id}`, '_blank');
                      }
                      setActiveMenu(null);
                    }}
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" /> Lihat transaksi
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
                  onClick={() => {
                    setActiveMenu(null);
                    onDelete(payment);
                  }}
                  role="menuitem"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus pembayaran
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
