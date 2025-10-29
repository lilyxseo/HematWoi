import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownRight, ArrowUpRight, Check, Info, Loader2, Wallet, X } from 'lucide-react';
import type { DebtPaymentRecord, DebtRecord } from '../../lib/api-debts';
import type { AccountRecord } from '../../lib/api';
import type { CategoryRecord } from '../../lib/api-categories';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
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

function getDefaultCategoryId(
  categories: CategoryRecord[],
  debtType: DebtRecord['type'] | null,
): string {
  if (!categories.length) return '';
  const target = debtType === 'receivable' ? 'piutang' : 'hutang';
  const match = categories.find((item) => item.name.trim().toLowerCase() === target);
  return match ? match.id : categories[0].id;
}

function toFormAmount(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return '';
  return formatAmountInput(String(Math.round(value)));
}

export type PaymentFormValues = {
  amount: number;
  date: string;
  notes?: string | null;
  account_id?: string | null;
  category_id?: string | null;
  recordTransaction: boolean;
  markAsPaid: boolean;
  allowOverpay?: boolean;
};

interface PaymentDrawerProps {
  open: boolean;
  mode: 'create' | 'edit';
  debt: DebtRecord | null;
  payments: DebtPaymentRecord[];
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  loading?: boolean;
  submitting?: boolean;
  deletingId?: string | null;
  accountsLoading?: boolean;
  categoriesLoading?: boolean;
  editingPayment: DebtPaymentRecord | null;
  onClose: () => void;
  onSubmit: (payload: PaymentFormValues) => Promise<void> | void;
  onUpdate: (paymentId: string, payload: PaymentFormValues) => Promise<void> | void;
  onEditPayment: (payment: DebtPaymentRecord) => void;
  onCancelEdit: () => void;
  onDeletePayment: (payment: DebtPaymentRecord) => void;
  onViewTransaction: (payment: DebtPaymentRecord) => void;
}

export default function PaymentDrawer({
  open,
  mode,
  debt,
  payments,
  accounts,
  categories,
  loading,
  submitting,
  deletingId,
  accountsLoading,
  categoriesLoading,
  editingPayment,
  onClose,
  onSubmit,
  onUpdate,
  onEditPayment,
  onCancelEdit,
  onDeletePayment,
  onViewTransaction,
}: PaymentDrawerProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [includeTransaction, setIncludeTransaction] = useState(true);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [allowOverpay, setAllowOverpay] = useState(false);
  const [errors, setErrors] = useState<{
    amount?: string;
    date?: string;
    account?: string;
  }>({});

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

  const resetForm = () => {
    setAmount('');
    setDate(todayIso());
    setNotes('');
    setIncludeTransaction(true);
    setAccountId('');
    setCategoryId('');
    setMarkAsPaid(true);
    setAllowOverpay(false);
    setErrors({});
  };

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && editingPayment) {
      setAmount(toFormAmount(editingPayment.amount));
      const paymentDate = editingPayment.date ? editingPayment.date.slice(0, 10) : todayIso();
      setDate(paymentDate);
      setNotes(editingPayment.notes ?? '');
      const hasTransaction = Boolean(editingPayment.transaction_id);
      setIncludeTransaction(hasTransaction);
      setAccountId(editingPayment.account_id ?? '');
      setMarkAsPaid(debt?.status === 'paid');
      setAllowOverpay(false);
      setErrors({});
    } else {
      resetForm();
    }
  }, [open, mode, editingPayment, debt?.status]);

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
    if (!open) return;
    if (!categories.length) {
      setCategoryId('');
      return;
    }
    setCategoryId((prev) => {
      if (prev && categories.some((category) => category.id === prev)) {
        return prev;
      }
      return getDefaultCategoryId(categories, debt?.type ?? null);
    });
  }, [open, categories, debt?.type]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  const remainingContext = useMemo(() => {
    if (!debt) {
      return {
        remainingBefore: 0,
        remainingAfter: 0,
        isOverpay: false,
      };
    }
    const parsedAmount = parseDecimal(amount);
    const editingAmount = mode === 'edit' && editingPayment ? editingPayment.amount : 0;
    const before = Math.max(0, debt.remaining + editingAmount);
    const after = Number.isNaN(parsedAmount) ? before : Math.max(0, before - parsedAmount);
    return {
      remainingBefore: before,
      remainingAfter: after,
      isOverpay: !Number.isNaN(parsedAmount) && parsedAmount > before,
    };
  }, [debt, amount, mode, editingPayment]);

  const typeIndicator = useMemo(() => {
    if (!debt) return null;
    const isReceivable = debt.type === 'receivable';
    const icon = isReceivable ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : <ArrowDownRight className="h-4 w-4" aria-hidden="true" />;
    const label = isReceivable ? 'Masuk (Piutang)' : 'Keluar (Hutang)';
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-surface-alt/80 px-3 py-1 text-xs font-semibold text-text/80">
        {icon}
        {label}
      </span>
    );
  }, [debt]);

  const remainingLabel = useMemo(() => {
    if (!debt) return currencyFormatter.format(0);
    return currencyFormatter.format(Math.max(0, debt.remaining));
  }, [debt]);

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

  const isSubmitDisabled = Boolean(submitting) || Boolean(accountsLoading) || Boolean(categoriesLoading);

  const accountLabel = debt?.type === 'receivable' ? 'Akun penerima' : 'Akun pembayar';

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

    if (includeTransaction) {
      if (!accountId) {
        nextErrors.account = accountsLoading ? 'Sedang memuat daftar akun…' : 'Pilih akun untuk transaksi.';
      }
    }

    if (nextErrors.amount || nextErrors.date || nextErrors.account) {
      setErrors(nextErrors);
      return;
    }

    const payload: PaymentFormValues = {
      amount: parsedAmount,
      date: trimmedDate || todayIso(),
      notes: notes.trim() ? notes.trim() : null,
      account_id: includeTransaction ? accountId || undefined : undefined,
      category_id: includeTransaction ? categoryId || undefined : undefined,
      recordTransaction: includeTransaction,
      markAsPaid,
      allowOverpay,
    };

    setErrors({});

    try {
      if (mode === 'edit' && editingPayment) {
        await onUpdate(editingPayment.id, payload);
      } else {
        await onSubmit(payload);
        resetForm();
      }
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
        className="relative z-[1] flex max-h-[min(92vh,820px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-surface-1/95 shadow-2xl backdrop-blur"
      >
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-border-subtle bg-surface px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{mode === 'edit' ? 'Ubah Pembayaran' : 'Catat Pembayaran'}</p>
            <h2 className="break-words text-lg font-semibold text-text">{debt.title}</h2>
            <p className="break-words text-sm text-muted">
              {debt.party_name} • {dateFormatter.format(new Date(debt.date))} • Tenor {tenorLabel}
            </p>
            {typeIndicator}
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
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sisa Tagihan Saat Ini</p>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                  <label htmlFor="payment-amount" className="form-label">
                    Nominal pembayaran
                  </label>
                  <div className="relative">
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
                      className="input h-11 text-right tabular-nums"
                    />
                    {remainingContext.isOverpay ? (
                      <span className="absolute inset-y-0 left-3 flex items-center text-xs text-amber-400">
                        <Info className="mr-1 h-3.5 w-3.5" aria-hidden="true" />Overpay
                      </span>
                    ) : null}
                  </div>
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
                    className="input h-11"
                  />
                  {errors.date ? <span className="form-error">{errors.date}</span> : null}
                </div>
              </div>

              <div className="grid gap-4 rounded-3xl border border-border/50 bg-surface-alt/70 p-4">
                <label className="flex items-start gap-3 text-sm text-text">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-border/60 text-brand focus:ring-brand"
                    checked={includeTransaction}
                    onChange={(event) => setIncludeTransaction(event.target.checked)}
                  />
                  <div>
                    <p className="font-semibold">Catat juga sebagai transaksi &amp; update saldo akun</p>
                    <p className="text-xs text-muted">
                      HematWoi akan membuat transaksi {debt.type === 'receivable' ? 'pemasukan' : 'pengeluaran'}
                      {' '}sesuai pembayaran ini.
                    </p>
                  </div>
                </label>

                {includeTransaction ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                      <label htmlFor="payment-account" className="form-label">
                        {accountLabel}
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
                        className="input h-11"
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
                      {errors.account ? <span className="form-error">{errors.account}</span> : null}
                      {!accountsLoading && accounts.length === 0 ? (
                        <span className="text-xs text-muted">Belum ada akun. Tambahkan akun baru melalui menu Akun.</span>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                      <label htmlFor="payment-category" className="form-label">
                        Kategori transaksi
                      </label>
                      <select
                        id="payment-category"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className="input h-11"
                        disabled={Boolean(categoriesLoading) || categories.length === 0}
                      >
                        {categoriesLoading ? (
                          <option value="">Memuat kategori…</option>
                        ) : (
                          <>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {!categoriesLoading && categories.length === 0 ? (
                        <span className="text-xs text-muted">Belum ada kategori. Tambahkan dari menu Kategori.</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-text">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border/60 text-brand focus:ring-brand"
                      checked={markAsPaid}
                      onChange={(event) => setMarkAsPaid(event.target.checked)}
                    />
                    Tandai sebagai lunas jika sisa = 0
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border/60 text-brand focus:ring-brand"
                      checked={allowOverpay}
                      onChange={(event) => setAllowOverpay(event.target.checked)}
                    />
                    Izinkan overpay
                  </label>
                </div>

                <div className="rounded-2xl border border-border/40 bg-surface/80 p-4 text-sm text-muted">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-semibold text-text">Ringkasan Sisa</span>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {currencyFormatter.format(remainingContext.remainingBefore)} →{' '}
                        {currencyFormatter.format(remainingContext.remainingAfter)}
                      </span>
                    </div>
                  </div>
                  {remainingContext.isOverpay && !allowOverpay ? (
                    <p className="mt-2 flex items-start gap-2 text-xs text-amber-300">
                      <Info className="mt-0.5 h-3.5 w-3.5" aria-hidden="true" />
                      Nominal melebihi sisa hutang. Aktifkan opsi overpay untuk tetap melanjutkan.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-notes" className="form-label">
                  Metode / Referensi
                </label>
                <textarea
                  id="payment-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Contoh: Transfer BCA • Bukti: https://…"
                  className="form-control"
                />
              </div>
            </form>

            <section className="min-h-[180px] min-w-0">
              {loading ? (
                <p className="flex items-center justify-center gap-2 rounded-3xl border border-dashed border-border-subtle/80 bg-surface-alt/60 px-4 py-6 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Memuat riwayat pembayaran…
                </p>
              ) : (
                <PaymentsList
                  payments={payments}
                  deletingId={deletingId}
                  onDelete={onDeletePayment}
                  onEdit={onEditPayment}
                  onViewTransaction={onViewTransaction}
                />
              )}
            </section>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface px-5 py-4 sm:px-6">
          <div className="flex flex-1 flex-wrap items-center gap-2 text-xs text-muted">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Pembayaran dicatat dengan timezone UTC. Pastikan nominal sesuai bukti transfer.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'edit' ? (
              <button type="button" onClick={onCancelEdit} className="btn btn-secondary">
                Batal Edit
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Tutup
            </button>
            <button
              type="submit"
              form="payment-form"
              disabled={isSubmitDisabled || (remainingContext.isOverpay && !allowOverpay)}
              aria-busy={Boolean(submitting)}
              className="btn btn-primary"
            >
              {submitting ? 'Menyimpan…' : mode === 'edit' ? 'Simpan Perubahan' : 'Catat Pembayaran'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
