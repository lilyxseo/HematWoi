import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { DebtPaymentRecord, DebtRecord } from '../../lib/api-debts';
import PaymentsList from './PaymentsList';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

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
  const [errors, setErrors] = useState<{ amount?: string; date?: string }>({});
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useLockBodyScroll(open);

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
    if (!open) return undefined;
    const node = panelRef.current;
    if (!node) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', handleKeyDown);
    return () => node.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setAmount('');
      setDate(todayIso());
      setNotes('');
      setErrors({});
    }
  }, [open, debt?.id]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

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
    const trimmedDate = date?.trim() ?? '';
    const nextErrors: { amount?: string; date?: string } = {};

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = 'Masukkan nominal lebih dari 0.';
    }

    const parsedDate = trimmedDate ? new Date(trimmedDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      nextErrors.date = 'Pilih tanggal pembayaran yang valid.';
    }

    if (nextErrors.amount || nextErrors.date) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        amount: parsedAmount,
        date: trimmedDate || todayIso(),
        notes: notes.trim() ? notes.trim() : null,
      });
      setAmount('');
      setNotes('');
    } catch (submitError) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.error('[HW][PaymentDrawer] submit', submitError);
      }
    }
  };

  if (!open || !debt) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur supports-[backdrop-filter]:bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-[70] w-full sm:w-[480px] md:w-[520px] h-[100dvh] bg-card shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <header className="sticky top-0 shrink-0 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Catat Pembayaran</p>
              <h2 className="mt-1 break-words text-lg font-semibold text-text">{debt.title}</h2>
              <p className="break-words text-sm text-muted">
                {debt.party_name} • {dateFormatter.format(new Date(debt.date))}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-text transition hover:bg-border/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)]"
              aria-label="Tutup panel pembayaran"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable]">
          <div className="min-w-0 space-y-4 sm:space-y-5">
            <section className="grid min-w-0 grid-cols-2 gap-3 rounded-2xl border p-3 sm:gap-4 sm:p-4">
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
                <p className="mt-1 break-words text-sm text-text/80">
                  {debt.due_date ? dateFormatter.format(new Date(debt.due_date)) : '-'}
                </p>
              </div>
            </section>

            <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="min-w-0 flex flex-col gap-1 text-sm font-medium text-text">
                <label htmlFor="payment-amount">Nominal pembayaran</label>
                <input
                  id="payment-amount"
                  type="text"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    if (errors.amount) {
                      setErrors((prev) => ({ ...prev, amount: undefined }));
                    }
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  placeholder="Masukkan nominal"
                  className="w-full h-[44px] rounded-xl bg-muted/20 border border-border px-3 text-sm focus:outline-none focus:ring-2 ring-primary"
                />
                {errors.amount ? <span className="mt-1 text-xs text-rose-300">{errors.amount}</span> : null}
              </div>

              <div className="min-w-0 flex flex-col gap-1 text-sm font-medium text-text">
                <label htmlFor="payment-date">Tanggal pembayaran</label>
                <input
                  id="payment-date"
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    if (errors.date) {
                      setErrors((prev) => ({ ...prev, date: undefined }));
                    }
                  }}
                  className="w-full h-[44px] rounded-xl bg-muted/20 border border-border px-3 text-sm focus:outline-none focus:ring-2 ring-primary"
                />
                {errors.date ? <span className="mt-1 text-xs text-rose-300">{errors.date}</span> : null}
              </div>

              <div className="min-w-0 flex flex-col gap-1 text-sm font-medium text-text">
                <label htmlFor="payment-notes">Catatan</label>
                <textarea
                  id="payment-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Catatan (opsional)"
                  className="w-full min-h-[96px] rounded-xl bg-muted/20 border border-border p-3 text-sm focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
            </form>

            <section className="min-h-[160px] min-w-0">
              {loading ? (
                <p className="rounded-2xl border border-dashed border-border/70 bg-surface-1/40 px-4 py-6 text-center text-sm text-muted">
                  Memuat riwayat pembayaran…
                </p>
              ) : (
                <PaymentsList payments={payments} onDelete={onDeletePayment} deletingId={deletingId} />
              )}
            </section>
          </div>
        </div>

        <footer className="sticky bottom-0 shrink-0 border-t border-border bg-card/95 px-4 pt-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-border bg-surface-1 px-5 text-sm font-medium text-text transition hover:bg-border/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)] sm:w-auto"
            >
              Tutup
            </button>
            <button
              type="submit"
              form="payment-form"
              disabled={Boolean(submitting)}
              aria-busy={Boolean(submitting)}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting ? 'Menyimpan…' : 'Catat Pembayaran'}
            </button>
          </div>
        </footer>
      </div>
    </>,
    document.body,
  );
}
