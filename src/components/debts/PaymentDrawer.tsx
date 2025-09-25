import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { DebtPaymentRecord, DebtRecord } from '../../lib/api-debts';
import type { AccountRecord } from '../../lib/api';
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

const jakartaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const todayIso = () => jakartaFormatter.format(new Date());

interface PaymentDrawerProps {
  open: boolean;
  debt: DebtRecord | null;
  payments: DebtPaymentRecord[];
  loading?: boolean;
  submitting?: boolean;
  deletingId?: string | null;
  accounts: AccountRecord[];
  accountsLoading?: boolean;
  onClose: () => void;
  onSubmit: (payload: { amount: number; paid_at: string; account_id: string; note?: string | null }) => Promise<void> | void;
  onDeletePayment: (payment: DebtPaymentRecord) => void;
}

export default function PaymentDrawer({
  open,
  debt,
  payments,
  loading,
  submitting,
  deletingId,
  accounts,
  accountsLoading,
  onClose,
  onSubmit,
  onDeletePayment,
}: PaymentDrawerProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; date?: string; account?: string }>({});
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
      setAccountId(accounts[0]?.id ?? '');
      setNote('');
      setErrors({});
    }
  }, [open, debt?.id, accounts]);

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
    const nextErrors: { amount?: string; date?: string; account?: string } = {};

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = 'Masukkan nominal lebih dari 0.';
    }

    const parsedDate = trimmedDate ? new Date(trimmedDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      nextErrors.date = 'Pilih tanggal pembayaran yang valid.';
    }

    if (!accountId) {
      nextErrors.account = 'Pilih sumber dana pembayaran.';
    }

    if (nextErrors.amount || nextErrors.date || nextErrors.account) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        amount: parsedAmount,
        paid_at: trimmedDate || todayIso(),
        account_id: accountId,
        note: note.trim() ? note.trim() : null,
      });
      setAmount('');
      setNote('');
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
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="drawer-panel w-full max-w-[100%] sm:max-w-[480px] md:max-w-[520px]"
        role="dialog"
        aria-modal="true"
      >
        <header className="drawer-header">
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
              className="btn btn-ghost btn-sm h-10 w-10 flex-shrink-0 rounded-full"
              aria-label="Tutup panel pembayaran"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="drawer-body">
          <div className="min-w-0 space-y-5">
            <section className="grid min-w-0 grid-cols-2 gap-3 rounded-3xl border border-border-subtle bg-surface-alt/80 p-4 shadow-sm sm:gap-4">
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
              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-amount" className="form-label">
                  Nominal pembayaran
                </label>
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
                  className="input text-right tabular-nums"
                />
                {errors.amount ? <span className="form-error">{errors.amount}</span> : null}
              </div>

              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-date" className="form-label">
                  Tanggal pembayaran
                </label>
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
                  className="input"
                />
                {errors.date ? <span className="form-error">{errors.date}</span> : null}
              </div>

              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-account" className="form-label">
                  Sumber dana
                </label>
                <select
                  id="payment-account"
                  value={accountId}
                  onChange={(event) => {
                    setAccountId(event.target.value);
                    if (errors.account) {
                      setErrors((prev) => ({ ...prev, account: undefined }));
                    }
                  }}
                  className="input"
                  disabled={accountsLoading || accounts.length === 0}
                >
                  {accountsLoading ? (
                    <option value="">Memuat akun…</option>
                  ) : null}
                  {!accountsLoading && accounts.length === 0 ? (
                    <option value="">Belum ada akun</option>
                  ) : null}
                  {!accountsLoading
                    ? accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))
                    : null}
                </select>
                {errors.account ? <span className="form-error">{errors.account}</span> : null}
                {!accountsLoading && accounts.length === 0 ? (
                  <span className="text-xs font-normal text-muted">
                    Tambahkan akun kas/bank terlebih dahulu untuk mencatat arus kas keluar.
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-notes" className="form-label">
                  Catatan
                </label>
                  <textarea
                    id="payment-notes"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Catatan (opsional)"
                  className="form-control"
                />
              </div>
            </form>

            <section className="min-h-[160px] min-w-0">
              {loading ? (
                <p className="rounded-3xl border border-dashed border-border-subtle/80 bg-surface-alt/60 px-4 py-6 text-center text-sm text-muted">
                  Memuat riwayat pembayaran…
                </p>
              ) : (
                <PaymentsList payments={payments} onDelete={onDeletePayment} deletingId={deletingId} />
              )}
            </section>
          </div>
        </div>

        <footer className="drawer-footer">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end sm:gap-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary w-full sm:w-auto"
            >
              Tutup
            </button>
            <button
              type="submit"
              form="payment-form"
              disabled={Boolean(submitting) || accountsLoading || accounts.length === 0}
              aria-busy={Boolean(submitting)}
              className="btn btn-primary w-full sm:w-auto"
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
