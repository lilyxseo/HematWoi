import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Tag, Wallet, X } from 'lucide-react';
import clsx from 'clsx';
import type { DebtPaymentRecord, DebtRecord } from '../../lib/api-debts';
import PaymentsList from './PaymentsList';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import type { AccountRecord } from '../../lib/api';
import type { CategoryRecord } from '../../lib/api-categories';

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

function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toLocaleString('id-ID');
}

const todayIso = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

interface PaymentDrawerProps {
  open: boolean;
  debt: DebtRecord | null;
  payments: DebtPaymentRecord[];
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  loading?: boolean;
  submitting?: boolean;
  deletingId?: string | null;
  accountsLoading?: boolean;
  categoriesLoading?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    amount: number;
    date: string;
    account_id?: string | null;
    notes?: string | null;
    category_id?: string | null;
    recordTransaction: boolean;
    markAsPaid: boolean;
    allowOverpay: boolean;
  }) => Promise<void> | void;
  onDeletePayment: (payment: DebtPaymentRecord) => void;
  onViewTransaction?: (payment: DebtPaymentRecord) => void;
  onEditPayment?: (payment: DebtPaymentRecord) => void;
}

export default function PaymentDrawer({
  open,
  debt,
  payments,
  accounts,
  categories,
  loading,
  submitting,
  deletingId,
  accountsLoading,
  categoriesLoading,
  onClose,
  onSubmit,
  onDeletePayment,
  onViewTransaction,
  onEditPayment,
}: PaymentDrawerProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [recordTransaction, setRecordTransaction] = useState(true);
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [allowOverpay, setAllowOverpay] = useState(false);
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
      setNotes('');
      setAccountId('');
      setCategoryId('');
      setRecordTransaction(true);
      setMarkAsPaid(true);
      setAllowOverpay(false);
      setErrors({});
    }
  }, [open, debt?.id]);

  useEffect(() => {
    if (!open) return;
    if (!accounts.length) {
      setAccountId('');
      return;
    }
    setAccountId((prev) => {
      if (prev && accounts.some((account) => account.id === prev)) {
        return prev;
      }
      return accounts[0]?.id ?? '';
    });
  }, [open, accounts]);

  useEffect(() => {
    if (!open || !recordTransaction) return;
    if (accountId) return;
    if (accounts.length) {
      setAccountId(accounts[0]?.id ?? '');
    }
  }, [open, recordTransaction, accountId, accounts]);

  const targetCategoryType = debt?.type === 'receivable' ? 'income' : 'expense';

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === targetCategoryType),
    [categories, targetCategoryType],
  );

  const defaultCategoryId = useMemo(() => {
    if (!filteredCategories.length) return '';
    const keyword = debt?.type === 'receivable' ? 'piutang' : 'hutang';
    const normalized = keyword.toLowerCase();
    const preferred = filteredCategories.find((category) =>
      category.name.toLowerCase().includes(normalized),
    );
    if (preferred) return preferred.id;
    return filteredCategories[0]?.id ?? '';
  }, [filteredCategories, debt?.type]);

  useEffect(() => {
    if (!open) return;
    if (!filteredCategories.length) {
      setCategoryId('');
      return;
    }
    setCategoryId((prev) => {
      if (prev && filteredCategories.some((category) => category.id === prev)) {
        return prev;
      }
      return defaultCategoryId;
    });
  }, [open, filteredCategories, defaultCategoryId]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  const parsedAmountValue = useMemo(() => parseDecimal(amount), [amount]);

  const remainingBefore = useMemo(() => {
    if (!debt) return 0;
    return Math.max(0, debt.remaining);
  }, [debt]);

  const remainingAfter = useMemo(() => {
    if (Number.isNaN(parsedAmountValue) || parsedAmountValue < 0) {
      return remainingBefore;
    }
    return Math.max(0, remainingBefore - parsedAmountValue);
  }, [remainingBefore, parsedAmountValue]);

  const isOverpay = useMemo(() => {
    if (Number.isNaN(parsedAmountValue)) return false;
    return parsedAmountValue > remainingBefore + 0.0001;
  }, [parsedAmountValue, remainingBefore]);

  const remainingLabel = useMemo(() => currencyFormatter.format(remainingBefore), [remainingBefore]);

  const totalPaidLabel = useMemo(() => {
    if (!debt) return currencyFormatter.format(0);
    return currencyFormatter.format(Math.max(0, debt.paid_total));
  }, [debt]);

  const tenorLabel = useMemo(() => {
    if (!debt) return '1/1';
    const total = Math.max(1, Math.floor(debt.tenor_months || 1));
    const current = Math.max(1, Math.min(Math.floor(debt.tenor_sequence || 1), total));
    return `${current}/${total}`;
  }, [debt]);

  const isSubmitDisabled =
    Boolean(submitting) || (recordTransaction && (Boolean(accountsLoading) || !accountId));

  const transactionTypeLabel = useMemo(
    () => (debt?.type === 'receivable' ? 'Pemasukan (income)' : 'Pengeluaran (expense)'),
    [debt?.type],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = parseDecimal(amount);
    const trimmedDate = date?.trim() ?? '';
    const nextErrors: { amount?: string; date?: string; account?: string } = {};

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = 'Masukkan nominal lebih dari 0.';
    }

    if (!Number.isNaN(parsedAmount) && parsedAmount > 0 && isOverpay && !allowOverpay) {
      nextErrors.amount = 'Nominal melebihi sisa tagihan. Aktifkan izin overpay untuk melanjutkan.';
    }

    const parsedDate = trimmedDate ? new Date(trimmedDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      nextErrors.date = 'Pilih tanggal pembayaran yang valid.';
    }

    if (recordTransaction && !accountId) {
      nextErrors.account = accountsLoading ? 'Sedang memuat daftar akun…' : 'Pilih akun sumber pembayaran.';
    }

    if (nextErrors.amount || nextErrors.date || nextErrors.account) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        amount: parsedAmount,
        date: trimmedDate || todayIso(),
        account_id: recordTransaction ? accountId : null,
        category_id: recordTransaction ? categoryId || null : null,
        notes: notes.trim() ? notes.trim() : null,
        recordTransaction,
        markAsPaid,
        allowOverpay,
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
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 px-3 py-4 sm:px-4 sm:py-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative z-[1] flex max-h-[min(92vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-surface-1/95 shadow-2xl backdrop-blur"
      >
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-border-subtle bg-surface px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Catat Pembayaran</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-text">{debt.title}</h2>
            <p className="break-words text-sm text-muted">
              {debt.party_name} • {dateFormatter.format(new Date(debt.date))} • Tenor {tenorLabel}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            aria-label="Tutup panel pembayaran"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-6">
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

            <form id="payment-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-amount" className="form-label">
                  Nominal pembayaran
                </label>
                <input
                  id="payment-amount"
                  type="text"
                  value={amount}
                  onChange={(event) => {
                    const formatted = formatAmountInput(event.target.value);
                    setAmount(formatted);
                    if (errors.amount) {
                      setErrors((prev) => ({ ...prev, amount: undefined }));
                    }
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Masukkan nominal"
                  className="input text-right tabular-nums"
                />
                {errors.amount ? <span className="form-error">{errors.amount}</span> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-3xl border border-border-subtle/70 bg-surface-alt/60 px-3 py-2 text-xs text-muted">
                  <span className="font-semibold text-text">Sisa:</span>
                  <span className="inline-flex items-center gap-2 font-semibold text-text">
                    {remainingLabel}
                    <ArrowDownRight className="h-4 w-4 text-muted" aria-hidden="true" />
                    <span className={clsx('tabular-nums', isOverpay ? 'text-amber-300' : 'text-brand')}>
                      {currencyFormatter.format(remainingAfter)}
                    </span>
                  </span>
                </div>
                {isOverpay ? (
                  <div
                    className={clsx(
                      'mt-2 flex items-start gap-2 rounded-2xl border px-3 py-2 text-xs leading-relaxed',
                      allowOverpay
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-400/60 bg-amber-400/10 text-amber-100',
                    )}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <p className="font-medium">
                      {allowOverpay
                        ? 'Nominal melebihi sisa dan akan tercatat sebagai pembayaran lebih.'
                        : 'Nominal melebihi sisa tagihan yang tersisa.'}
                    </p>
                  </div>
                ) : null}
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

              <div className="space-y-3 rounded-3xl border border-border-subtle bg-surface-alt/70 p-4">
                <label className="flex items-start gap-3 text-sm font-medium text-text">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border"
                    checked={recordTransaction}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setRecordTransaction(checked);
                      if (!checked) {
                        setErrors((prev) => ({ ...prev, account: undefined }));
                      }
                    }}
                  />
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-text">
                      Catat juga sebagai transaksi &amp; update saldo akun
                    </span>
                    <span className="block text-xs text-muted">
                      Transaksi {transactionTypeLabel.toLowerCase()} akan dibuat dan saldo akun diperbarui otomatis.
                    </span>
                  </span>
                </label>

                {recordTransaction ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface px-3 py-2.5 text-sm">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                        {debt?.type === 'receivable' ? (
                          <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted">Tipe transaksi</p>
                        <p className="text-sm font-semibold text-text">{transactionTypeLabel}</p>
                      </div>
                    </div>

                    <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text md:col-span-1">
                      <label htmlFor="payment-account" className="form-label">
                        Akun sumber/tujuan
                      </label>
                      <div className="relative">
                        <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                        <select
                          id="payment-account"
                          value={accountId}
                          onChange={(event) => {
                            setAccountId(event.target.value);
                            if (errors.account) {
                              setErrors((prev) => ({ ...prev, account: undefined }));
                            }
                          }}
                          className="input pl-10"
                          disabled={!recordTransaction || Boolean(accountsLoading) || accounts.length === 0}
                        >
                          {accountsLoading ? (
                            <option value="">Memuat akun…</option>
                          ) : (
                            <>
                              <option value="">Pilih akun</option>
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.name}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                      {errors.account ? <span className="form-error">{errors.account}</span> : null}
                      {!accountsLoading && accounts.length === 0 ? (
                        <span className="text-xs text-muted">Belum ada akun. Tambahkan melalui menu Akun.</span>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text md:col-span-1">
                      <label htmlFor="payment-category" className="form-label">
                        Kategori transaksi
                      </label>
                      <div className="relative">
                        <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                        <select
                          id="payment-category"
                          value={categoryId}
                          onChange={(event) => setCategoryId(event.target.value)}
                          className="input pl-10"
                          disabled={!recordTransaction || Boolean(categoriesLoading) || filteredCategories.length === 0}
                        >
                          {categoriesLoading ? (
                            <option value="">Memuat kategori…</option>
                          ) : (
                            <>
                              <option value="">Pilih kategori</option>
                              {filteredCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                      {!categoriesLoading && filteredCategories.length === 0 ? (
                        <span className="text-xs text-muted">
                          Belum ada kategori {targetCategoryType === 'income' ? 'pemasukan' : 'pengeluaran'} tersedia.
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={markAsPaid}
                    onClick={() => setMarkAsPaid((prev) => !prev)}
                    className={clsx(
                      'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]',
                      markAsPaid
                        ? 'border-brand/50 bg-brand/10 text-brand-foreground'
                        : 'border-border/70 bg-surface text-text',
                    )}
                  >
                    <span className="flex-1">
                      <span className="font-semibold text-text">Tandai sebagai lunas jika sisa = 0</span>
                      <span className="mt-0.5 block text-xs text-muted">Status hutang/piutang akan menjadi lunas otomatis.</span>
                    </span>
                    <span
                      className={clsx(
                        'relative inline-flex h-6 w-12 flex-shrink-0 items-center rounded-full transition',
                        markAsPaid ? 'bg-brand' : 'bg-border',
                      )}
                    >
                      <span
                        className={clsx(
                          'h-5 w-5 transform rounded-full bg-surface shadow transition',
                          markAsPaid ? 'translate-x-6' : 'translate-x-1',
                        )}
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={allowOverpay}
                    onClick={() => setAllowOverpay((prev) => !prev)}
                    className={clsx(
                      'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]',
                      allowOverpay
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100'
                        : 'border-border/70 bg-surface text-text',
                    )}
                  >
                    <span className="flex-1">
                      <span className="font-semibold text-text">Izinkan nominal melebihi sisa</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        Cocok saat ingin mencatat pembayaran lebih besar dari sisa tagihan.
                      </span>
                    </span>
                    <span
                      className={clsx(
                        'relative inline-flex h-6 w-12 flex-shrink-0 items-center rounded-full transition',
                        allowOverpay ? 'bg-emerald-400' : 'bg-border',
                      )}
                    >
                      <span
                        className={clsx(
                          'h-5 w-5 transform rounded-full bg-surface shadow transition',
                          allowOverpay ? 'translate-x-6' : 'translate-x-1',
                        )}
                      />
                    </span>
                  </button>
                </div>
              </div>

              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-notes" className="form-label">
                  Catatan atau referensi
                </label>
                <textarea
                  id="payment-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Contoh: transfer via BCA, bukti URL, dll"
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
                <PaymentsList
                  payments={payments}
                  onDelete={onDeletePayment}
                  onViewTransaction={onViewTransaction}
                  onEdit={onEditPayment}
                  deletingId={deletingId}
                />
              )}
            </section>
          </div>
        </div>

        <footer className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border-subtle bg-surface px-5 py-4 sm:px-6">
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
            disabled={isSubmitDisabled}
            aria-busy={Boolean(submitting)}
            className="btn btn-primary w-full sm:w-auto"
          >
            {submitting ? 'Menyimpan…' : 'Catat Pembayaran'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
