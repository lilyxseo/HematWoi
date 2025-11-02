import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownLeft, ArrowUpRight, Info, Wallet, X } from 'lucide-react';
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

const OVERPAY_TOLERANCE = 0.0001;

type TransactionType = 'income' | 'expense';

const TYPE_SUMMARY: Record<DebtRecord['type'], { title: string; transaction: TransactionType }> = {
  debt: { title: 'Hutang', transaction: 'expense' },
  receivable: { title: 'Piutang', transaction: 'income' },
};

interface PaymentFormPayload {
  amount: number;
  date: string;
  notes?: string | null;
  includeTransaction: boolean;
  accountId?: string | null;
  categoryId?: string | null;
  markAsPaid: boolean;
  allowOverpay: boolean;
}

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
  onSubmit: (payload: PaymentFormPayload) => Promise<void> | void;
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
  const [includeTransaction, setIncludeTransaction] = useState(true);
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [allowOverpay, setAllowOverpay] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; date?: string; account?: string; category?: string }>({});
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
      setIncludeTransaction(true);
      setMarkAsPaid(true);
      setAllowOverpay(false);
      setErrors({});
    }
  }, [open, debt?.id]);

  const transactionType: TransactionType = useMemo(() => {
    if (!debt) return 'expense';
    return TYPE_SUMMARY[debt.type]?.transaction ?? 'expense';
  }, [debt]);

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === transactionType),
    [categories, transactionType],
  );

  const defaultCategoryId = useMemo(() => {
    if (!filteredCategories.length) return '';
    const targetName = transactionType === 'income' ? 'piutang' : 'hutang';
    const directMatch = filteredCategories.find(
      (category) => category.name.trim().toLowerCase() === targetName,
    );
    if (directMatch) return directMatch.id;
    return filteredCategories[0]?.id ?? '';
  }, [filteredCategories, transactionType]);

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
      if (!prev && includeTransaction) {
        return accounts[0]?.id ?? '';
      }
      return prev ?? '';
    });
  }, [open, includeTransaction, accounts]);

  useEffect(() => {
    if (!open || !includeTransaction) {
      setCategoryId('');
      return;
    }
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
  }, [open, includeTransaction, filteredCategories, defaultCategoryId]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  const remainingBefore = useMemo(() => {
    if (!debt) return 0;
    return Math.max(0, debt.remaining);
  }, [debt]);

  const parsedAmount = useMemo(() => parseDecimal(amount), [amount]);
  const overpay = Number.isFinite(parsedAmount) && parsedAmount - remainingBefore > OVERPAY_TOLERANCE;
  const remainingAfter = useMemo(() => {
    if (!Number.isFinite(parsedAmount)) return remainingBefore;
    return Math.max(0, remainingBefore - Math.max(parsedAmount, 0));
  }, [parsedAmount, remainingBefore]);

  const remainingLabel = useMemo(() => currencyFormatter.format(Math.max(0, remainingBefore)), [remainingBefore]);
  const remainingAfterLabel = useMemo(() => currencyFormatter.format(Math.max(0, remainingAfter)), [remainingAfter]);

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

  const isSubmitDisabled = useMemo(() => {
    if (submitting) return true;
    if (includeTransaction) {
      if (accountsLoading) return true;
      if (!accountId) return true;
      if (filteredCategories.length > 0 && !categoryId) return true;
    }
    return false;
  }, [submitting, includeTransaction, accountsLoading, accountId, filteredCategories, categoryId]);

  const transactionTypeLabel = transactionType === 'income' ? 'Pemasukan' : 'Pengeluaran';
  const TransactionIcon = transactionType === 'income' ? ArrowUpRight : ArrowDownLeft;
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseDecimal(amount);
    const trimmedDate = date?.trim() ?? '';
    const nextErrors: { amount?: string; date?: string; account?: string; category?: string } = {};

    if (Number.isNaN(parsed) || parsed <= 0) {
      nextErrors.amount = 'Masukkan nominal lebih dari 0.';
    }

    if (!trimmedDate || Number.isNaN(new Date(trimmedDate).getTime())) {
      nextErrors.date = 'Pilih tanggal pembayaran yang valid.';
    }

    if (!allowOverpay && overpay) {
      nextErrors.amount = 'Nominal melebihi sisa hutang/piutang.';
    }

    if (includeTransaction) {
      if (!accountId) {
        nextErrors.account = accountsLoading ? 'Sedang memuat daftar akun…' : 'Pilih akun untuk mencatat transaksi.';
      }
      if (filteredCategories.length > 0 && !categoryId) {
        nextErrors.category = 'Pilih kategori transaksi.';
      }
    }

    if (nextErrors.amount || nextErrors.date || nextErrors.account || nextErrors.category) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        amount: parsed,
        date: trimmedDate || todayIso(),
        notes: notes.trim() ? notes.trim() : null,
        includeTransaction,
        accountId: accountId || null,
        categoryId: includeTransaction ? categoryId || null : null,
        markAsPaid,
        allowOverpay,
      });
      setAmount('');
      setNotes('');
      setAllowOverpay(false);
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
        className="relative z-[1] flex max-h-[min(92vh,780px)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border/60 bg-surface-1/95 shadow-2xl backdrop-blur"
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
                {!allowOverpay && overpay ? (
                  <div className="flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <div className="space-y-1">
                      <p>Nominal melebihi sisa hutang/piutang. Aktifkan opsi di bawah bila tetap ingin melanjutkan.</p>
                      <label className="inline-flex items-center gap-2 font-medium text-amber-100">
                        <input
                          type="checkbox"
                          checked={allowOverpay}
                          onChange={(event) => {
                            setAllowOverpay(event.target.checked);
                            if (errors.amount) {
                              setErrors((prev) => ({ ...prev, amount: undefined }));
                            }
                          }}
                          className="h-4 w-4 rounded border-border-subtle bg-surface text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        />
                        Izinkan kelebihan bayar
                      </label>
                    </div>
                  </div>
                ) : null}
                {allowOverpay && overpay ? (
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                    <input
                      type="checkbox"
                      checked={allowOverpay}
                      onChange={(event) => setAllowOverpay(event.target.checked)}
                      className="h-4 w-4 rounded border-border-subtle bg-surface text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    />
                    Izinkan kelebihan bayar
                  </label>
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

              <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                <label htmlFor="payment-notes" className="form-label">
                  Metode / Referensi (opsional)
                </label>
                <textarea
                  id="payment-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Contoh: Transfer BCA, Bukti #123"
                  className="form-control"
                />
              </div>

              <div className="rounded-3xl border border-border-subtle bg-surface-alt/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Opsi Transaksi</p>
                    <p className="text-sm text-muted">Catat transaksi sekaligus untuk memperbarui saldo akun otomatis.</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-text">
                    <input
                      type="checkbox"
                      checked={includeTransaction}
                      onChange={(event) => {
                        setIncludeTransaction(event.target.checked);
                        setErrors((prev) => ({ ...prev, account: undefined, category: undefined }));
                      }}
                      className="h-4 w-4 rounded border-border-subtle bg-surface text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    />
                    Catat juga transaksi & update saldo akun
                  </label>
                </div>

                {includeTransaction ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <TransactionIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tipe transaksi</p>
                        <p className="font-semibold text-text">{transactionTypeLabel}</p>
                      </div>
                    </div>

                    <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                      <label htmlFor="payment-account" className="form-label inline-flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted" aria-hidden="true" /> Akun sumber dana
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
                        onChange={(event) => {
                          setCategoryId(event.target.value);
                          if (errors.category) {
                            setErrors((prev) => ({ ...prev, category: undefined }));
                          }
                        }}
                        className="input"
                        disabled={filteredCategories.length === 0}
                      >
                        {filteredCategories.length === 0 ? (
                          <option value="">
                            {categoriesLoading ? 'Memuat kategori…' : 'Tidak ada kategori tersedia'}
                          </option>
                        ) : (
                          filteredCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))
                        )}
                      </select>
                      {errors.category ? <span className="form-error">{errors.category}</span> : null}
                      {filteredCategories.length === 0 ? (
                        <span className="text-xs text-muted">
                          Tambahkan kategori {transactionType === 'income' ? 'pemasukan' : 'pengeluaran'} terlebih dahulu jika diperlukan.
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text">
                      <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-border/50 text-muted">
                        <Info className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Catatan tanpa transaksi</p>
                        <p className="text-sm text-muted">
                          Simpan informasi akun sebagai referensi. Saldo akun dan riwayat transaksi tidak berubah otomatis.
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 flex flex-col gap-1.5 text-sm font-medium text-text">
                      <label htmlFor="payment-account-note" className="form-label inline-flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted" aria-hidden="true" /> Akun sumber dana (opsional)
                      </label>
                      <select
                        id="payment-account-note"
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                        className="input"
                        disabled={Boolean(accountsLoading) || accounts.length === 0}
                      >
                        {accountsLoading ? (
                          <option value="">Memuat akun…</option>
                        ) : (
                          <>
                            <option value="">Tidak pilih akun</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {!accountsLoading && accounts.length === 0 ? (
                        <span className="text-xs text-muted">Belum ada akun. Tambahkan akun baru melalui menu Akun.</span>
                      ) : (
                        <span className="text-xs text-muted">Saldo akun tidak akan diperbarui otomatis.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-border-subtle bg-surface-alt/80 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sisa setelah pembayaran</p>
                    <p className="mt-1 text-lg font-semibold text-text tabular-nums">{remainingAfterLabel}</p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-text">
                    <input
                      type="checkbox"
                      checked={markAsPaid}
                      onChange={(event) => setMarkAsPaid(event.target.checked)}
                      className="h-4 w-4 rounded border-border-subtle bg-surface text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    />
                    Tandai sebagai lunas jika sisa = 0
                  </label>
                </div>
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
