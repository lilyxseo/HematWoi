import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { DebtPaymentRecord, DebtRecord } from '../../lib/api-debts';
import PaymentsList from './PaymentsList';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
});

function parseDecimal(value: string): number {
  if (!value) return Number.NaN;
  const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

const todayIso = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

interface PaymentDrawerProps {
  open: boolean;
  debt: DebtRecord | null;
  payments: DebtPaymentRecord[];
  loading?: boolean;
  submitting?: boolean;
  deletingId?: string | null;
  onClose: () => void;
  onSubmit: (payload: { amount: number; date: string; notes?: string | null }) => Promise<void> | void;
  onDeletePayment: (payment: DebtPaymentRecord) => void;
}

export default function PaymentDrawer({
  open,
  debt,
  payments,
  loading,
  submitting,
  deletingId,
  onClose,
  onSubmit,
  onDeletePayment,
}: PaymentDrawerProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setAmount('');
      setDate(todayIso());
      setNotes('');
      setError(null);
    }
  }, [open, debt?.id]);

  const remainingLabel = useMemo(() => {
    if (!debt) return currencyFormatter.format(0);
    return currencyFormatter.format(Math.max(0, debt.remaining));
  }, [debt]);

  const totalPaidLabel = useMemo(() => {
    if (!debt) return currencyFormatter.format(0);
    return currencyFormatter.format(Math.max(0, debt.paid_total));
  }, [debt]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = parseDecimal(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Masukkan nominal lebih dari 0.');
      return;
    }
    setError(null);
    await onSubmit({
      amount: parsedAmount,
      date: date || todayIso(),
      notes: notes.trim() ? notes.trim() : null,
    });
    setAmount('');
    setNotes('');
  };

  if (!open || !debt) return null;

  return createPortal(
    <div className="fixed inset-0 z-[75] flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-md flex-col gap-6 border-l border-border/60 bg-surface-1/95 p-6 shadow-xl backdrop-blur">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Catat Pembayaran</p>
            <h2 className="mt-1 text-lg font-semibold text-text">{debt.title}</h2>
            <p className="text-sm text-muted">
              {debt.party_name} • {dateFormatter.format(new Date(debt.date))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 text-text hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            aria-label="Tutup panel pembayaran"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <section className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-surface-1/80 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sisa Tagihan</p>
            <p className="mt-1 text-lg font-semibold text-text tabular-nums">{remainingLabel}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Terbayar</p>
            <p className="mt-1 text-lg font-semibold text-text tabular-nums">{totalPaidLabel}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
            <p className="mt-1 text-sm font-medium text-text">
              {debt.status === 'paid' ? 'Lunas' : debt.status === 'overdue' ? 'Jatuh Tempo' : 'Berjalan'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Jatuh Tempo</p>
            <p className="mt-1 text-sm text-text/80">{debt.due_date ? dateFormatter.format(new Date(debt.due_date)) : '-'}</p>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col gap-1 text-sm font-medium text-text">
            <label htmlFor="payment-amount">Nominal pembayaran</label>
            <input
              id="payment-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="Masukkan nominal"
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            />
            {error ? <span className="text-xs text-danger">{error}</span> : null}
          </div>

          <div className="flex flex-col gap-1 text-sm font-medium text-text">
            <label htmlFor="payment-date">Tanggal pembayaran</label>
            <input
              id="payment-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-[40px] rounded-xl border border-border bg-surface-1 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            />
          </div>

          <div className="flex flex-col gap-1 text-sm font-medium text-text">
            <label htmlFor="payment-notes">Catatan</label>
            <textarea
              id="payment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              placeholder="Catatan (opsional)"
            />
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[42px] items-center justify-center rounded-xl border border-border bg-surface-1 px-5 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={Boolean(submitting)}
              className="inline-flex h-[42px] items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Menyimpan…' : 'Catat Pembayaran'}
            </button>
          </div>
        </form>

        <section className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="rounded-2xl border border-dashed border-border/70 bg-surface-1/40 px-4 py-6 text-center text-sm text-muted">
              Memuat riwayat pembayaran…
            </p>
          ) : (
            <PaymentsList payments={payments} onDelete={onDeletePayment} deletingId={deletingId} />
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}
