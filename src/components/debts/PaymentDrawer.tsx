import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Check, Info, X } from 'lucide-react';
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
    notes?: string | null;
    recordTransaction: boolean;
    accountId?: string;
    categoryId?: string | null;
    markAsPaid: boolean;
    allowOverpay: boolean;
  }) => Promise<void> | void;
  onDeletePayment: (payment: DebtPaymentRecord) => void;
  onViewTransaction?: (transactionId: string) => void;
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
}: PaymentDrawerProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [recordTransaction, setRecordTransaction] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [allowOverpay, setAllowOverpay] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; date?: string; account?: string; category?: string }>({});
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useLockBodyScroll(open);

  const isReceivable = debt?.type === 'receivable';
  const relevantCategories = useMemo(() => {
    const type = isReceivable ? 'income' : 'expense';
    return categories.filter((item) => item.type === type);
  }, [categories, isReceivable]);

  const suggestedCategoryId = useMemo(() => {
    const keyword = isReceivable ? 'piutang' : 'hutang';
    const prioritized = relevantCategories.find((item) => item.name.toLowerCase().includes(keyword));
    return prioritized?.id ?? relevantCategories[0]?.id ?? '';
  }, [relevantCategories, isReceivable]);

  useEffect(() => {
    if (open) {
      setAmount('');
      setDate(todayIso());
      setNotes('');
      setRecordTransaction(accounts.length > 0);
      setMarkAsPaid(true);
      setAllowOverpay(false);
      setErrors({});
    }
  }, [open, accounts.length, debt?.id]);

  useEffect(() => {
    if (!open) return;
    if (!recordTransaction) {
      setAccountId('');
      setCategoryId('');
      return;
    }
    setAccountId((prev) => {
      if (prev && accounts.some((account) => account.id === prev)) {
        return prev;
      }
      return accounts[0]?.id ?? '';
    });
    setCategoryId((prev) => {
      if (prev && relevantCategories.some((category) => category.id === prev)) {
        return prev;
      }
      return suggestedCategoryId;
    });
  }, [open, recordTransaction, accounts, relevantCategories, suggestedCategoryId]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

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

  const remainingBefore = useMemo(() => {
    if (!debt) return 0;
    return Math.max(0, debt.remaining);
  }, [debt]);

  const parsedAmount = useMemo(() => parseDecimal(amount), [amount]);

  const remainingAfter = useMemo(() => {
    if (!debt || Number.isNaN(parsedAmount)) return remainingBefore;
    const next = Math.max(remainingBefore - parsedAmount, 0);
    return Number.isFinite(next) ? next : remainingBefore;
  }, [debt, parsedAmount, remainingBefore]);

  const overpayAmount = useMemo(() => {
    if (Number.isNaN(parsedAmount)) return 0;
    return Math.max(parsedAmount - remainingBefore, 0);
  }, [parsedAmount, remainingBefore]);

  const disallowOverpay = overpayAmount > 0 && !allowOverpay;

  const transactionTypeLabel = isReceivable ? 'Penerimaan (income)' : 'Pembayaran (expense)';

  const isSubmitDisabled =
    Boolean(submitting) ||
    Boolean(accountsLoading) ||
    (recordTransaction && (!accountId || (relevantCategories.length > 0 && !categoryId)));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedDate = date?.trim() ?? '';
    const nextErrors: typeof errors = {};

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = 'Masukkan nominal lebih dari 0.';
    } else if (disallowOverpay) {
      nextErrors.amount = 'Nominal melebihi sisa. Aktifkan opsi overpay jika tetap ingin melanjutkan.';
    }

    const parsedDate = trimmedDate ? new Date(trimmedDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      nextErrors.date = 'Pilih tanggal pembayaran yang valid.';
    }

    if (recordTransaction) {
      if (!accountId) {
        nextErrors.account = accountsLoading ? 'Sedang memuat akun…' : 'Pilih akun sumber dana.';
      }
      if (relevantCategories.length > 0 && !categoryId) {
        nextErrors.category = categoriesLoading ? 'Memuat kategori…' : 'Pilih kategori transaksi.';
      }
    }

    if (nextErrors.amount || nextErrors.date || nextErrors.account || nextErrors.category) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        amount: parsedAmount,
        date: trimmedDate || todayIso(),
        notes: notes.trim() ? notes.trim() : null,
        recordTransaction,
        accountId: recordTransaction ? accountId || undefined : undefined,
        categoryId: recordTransaction ? categoryId || null : null,
        markAsPaid,
        allowOverpay,
      });
      setAmount('');
      setNotes('');
      setAllowOverpay(false);
      if (recordTransaction && relevantCategories.length > 0) {
        setCategoryId(suggestedCategoryId);
      }
    } catch (submitError) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.error('[HW][PaymentDrawer] submit', submitError);
      }
    }
  };

  if (!open || !debt) return null;

  const amountError = errors.amount;
  const dateError = errors.date;
  const accountError = errors.account;
  const categoryError = errors.category;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 px-3 py-4 sm:px-4 sm:py-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative z-[1] flex max-h-[min(92vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-surface-1/95 shadow-2xl backdrop-blur"
      >
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-border-subtle bg-surface px-5 py-4 sm:px-6 sm:py-5">
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
            className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
            aria-label="Tutup panel pembayaran"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-6">
            <section className="grid min-w-0 gap-3 rounded-3xl border border-border-subtle bg-surface-alt/80 p-4 shadow-sm sm:grid-cols-2 sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sisa sebelum</p>
                <p className="mt-1 text-lg font-semibold text-text tabular-nums">{currencyFormatter.format(remainingBefore)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sisa setelah</p>
                <p className="mt-1 text-lg font-semibold text-text tabular-nums">{currencyFormatter.format(remainingAfter)}</p>
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
              <div className="grid gap-4 md:grid-cols-2">
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
                  {amountError ? <span className="form-error">{amountError}</span> : null}
                  {overpayAmount > 0 ? (
                    <p className={clsx('text-xs', disallowOverpay ? 'text-danger' : 'text-brand')}>
                      Overpay {currencyFormatter.format(overpayAmount)}
                    </p>
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
                  {dateError ? <span className="form-error">{dateError}</span> : null}
                </div>
              </div>

              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-notes" className="form-label">
                  Metode / Referensi (opsional)
                </label>
                <textarea
                  id="payment-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Contoh: transfer BCA / bukti URL"
                  className="form-control"
                />
              </div>

              <section className="space-y-4 rounded-3xl border border-border-subtle bg-surface-alt/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface text-brand',
                      )}
                    >
                      {(isReceivable ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-text">Catat juga sebagai transaksi &amp; update saldo akun</p>
                      <p className="text-xs text-muted">Saldo akun akan otomatis {isReceivable ? 'bertambah' : 'berkurang'}.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={recordTransaction}
                    onClick={() => {
                      setRecordTransaction((prev) => !prev);
                      setErrors((prev) => ({ ...prev, account: undefined, category: undefined }));
                    }}
                    className={clsx(
                      'flex h-10 w-16 items-center rounded-full border border-border px-1 transition',
                      recordTransaction ? 'justify-end bg-brand text-brand-foreground' : 'justify-start bg-surface text-muted',
                    )}
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface shadow">
                      {recordTransaction ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                    </span>
                  </button>
                </div>

                {recordTransaction ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5 text-sm font-medium text-text">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tipe transaksi</span>
                      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2.5 text-sm">
                        {isReceivable ? (
                          <ArrowDownRight className="h-4 w-4 text-brand" aria-hidden="true" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-brand" aria-hidden="true" />
                        )}
                        <span>{transactionTypeLabel}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-sm font-medium text-text">
                      <label htmlFor="payment-account" className="form-label">
                        Akun {isReceivable ? 'penerima' : 'sumber dana'}
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
                        disabled={Boolean(accountsLoading) || accounts.length === 0}
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
                      {accountError ? <span className="form-error">{accountError}</span> : null}
                      {!accountsLoading && accounts.length === 0 ? (
                        <p className="text-xs text-muted">Belum ada akun. Tambahkan akun melalui menu Akun.</p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1.5 text-sm font-medium text-text">
                      <label htmlFor="payment-category" className="form-label">
                        Kategori transaksi
                      </label>
                      <select
                        id="payment-category"
                        value={categoryId}
                        onChange={(event) => {
                          setCategoryId(event.target.value);
                          if (errors.category) {
                            setErrors((prev) => ({ ...prev, category: undefined }));
                          }
                        }}
                        className="input"
                        disabled={Boolean(categoriesLoading) || relevantCategories.length === 0}
                      >
                        {categoriesLoading ? (
                          <option value="">Memuat kategori…</option>
                        ) : (
                          <>
                            <option value="">Pilih kategori</option>
                            {relevantCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {categoryError ? <span className="form-error">{categoryError}</span> : null}
                      {!categoriesLoading && relevantCategories.length === 0 ? (
                        <p className="text-xs text-muted">
                          Belum ada kategori {isReceivable ? 'pemasukan' : 'pengeluaran'} tersedia.
                        </p>
                      ) : null}
                    </div>

                  </div>
                ) : null}

                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-text">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-text">Tandai sebagai lunas jika sisa = 0</p>
                      <p className="text-xs text-muted">Status akan berubah menjadi lunas ketika sisa mencapai nol.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={markAsPaid}
                      onClick={() => setMarkAsPaid((prev) => !prev)}
                      className={clsx(
                        'flex h-9 w-16 items-center rounded-full border border-border px-1 transition',
                        markAsPaid ? 'justify-end bg-brand text-brand-foreground' : 'justify-start bg-surface text-muted',
                      )}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow">
                        {markAsPaid ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-text">
                  <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-4 w-4 text-brand" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-text">Izinkan pembayaran melewati sisa?</p>
                      <p className="text-xs text-muted">
                        Aktifkan jika ingin mencatat nominal lebih besar dari sisa hutang/piutang.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowOverpay}
                      onClick={() => {
                        setAllowOverpay((prev) => !prev);
                        if (errors.amount) {
                          setErrors((prev) => ({ ...prev, amount: undefined }));
                        }
                      }}
                      className={clsx(
                        'ml-auto flex h-9 w-16 items-center rounded-full border border-border px-1 transition',
                        allowOverpay ? 'justify-end bg-brand text-brand-foreground' : 'justify-start bg-surface text-muted',
                      )}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow">
                        {allowOverpay ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                      </span>
                    </button>
                  </div>
                </div>
              </section>
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
                  deletingId={deletingId}
                  onViewTransaction={onViewTransaction}
                />
              )}
            </section>
          </div>
        </div>

        <footer className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border-subtle bg-surface px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="btn btn-secondary w-full sm:w-auto">
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
