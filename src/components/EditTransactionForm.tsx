import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useToast } from '../context/ToastContext.jsx';
import type { AccountRecord } from '../lib/api';
import { listAccounts } from '../lib/api';
import { useCategoriesForEdit } from '../hooks/useCategoriesForEdit';
import type { Tx } from '../services/transactions';
import {
  getTransactionById,
  updateTransaction,
  type UpdateTransactionPayload,
} from '../services/transactions';

const TYPE_OPTIONS: { value: Tx['type']; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

type FormState = {
  date: string;
  type: Tx['type'];
  category_id: string | null;
  amount: string;
  account_id: string | null;
  to_account_id: string | null;
  title: string;
  notes: string;
};

type EditTransactionFormProps = {
  transactionId: string;
  onSaved?: (tx: Tx) => void;
  onCancel: () => void;
};

const CURRENCY_FORMATTER =
  typeof Intl !== 'undefined'
    ? new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      })
    : null;

function normalizeAmount(input: string): number {
  const cleaned = input.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  return CURRENCY_FORMATTER ? CURRENCY_FORMATTER.format(amount) : amount.toString();
}

export default function EditTransactionForm({
  transactionId,
  onSaved,
  onCancel,
}: EditTransactionFormProps) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<Tx | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [form, setForm] = useState<FormState | null>(null);

  const { options: categoryOptions, appendedCategoryIds, isLoading: isCategoryLoading } =
    useCategoriesForEdit(form?.type ?? 'transfer', form?.category_id ?? undefined);

  const appendedCategorySet = useMemo(() => new Set(appendedCategoryIds), [appendedCategoryIds]);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const tx = await getTransactionById(transactionId);
        if (!active) return;

        if (!tx) {
          setError('Transaksi tidak ditemukan atau sudah dihapus.');
          setForm(null);
          setTransaction(null);
          return;
        }

        setTransaction(tx);
        setForm({
          date: tx.date ?? '',
          type: tx.type,
          category_id: tx.category_id,
          amount: tx.amount ? String(tx.amount) : '',
          account_id: tx.account_id,
          to_account_id: tx.to_account_id,
          title: tx.title ?? '',
          notes: tx.notes ?? '',
        });

        try {
          const userAccounts = await listAccounts(tx.user_id);
          if (!active) return;
          setAccounts(userAccounts);
        } catch (accountsError) {
          console.error('[transactions:detail] Failed to load accounts', accountsError);
          if (!active) return;
          setAccounts([]);
        }
      } catch (err) {
        console.error('[transactions:detail] Failed to load transaction', err);
        if (!active) return;
        setError('Gagal memuat transaksi. Silakan coba lagi.');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [transactionId]);

  const handleChange = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => {
      if (!prev) return prev;

      if (field === 'type') {
        const nextType = value as Tx['type'];
        return {
          ...prev,
          type: nextType,
          category_id: nextType === 'transfer' ? null : prev.category_id,
          to_account_id: nextType === 'transfer' ? prev.to_account_id : null,
        };
      }

      if (field === 'category_id' || field === 'account_id' || field === 'to_account_id') {
        return {
          ...prev,
          [field]: value ? value : null,
        };
      }

      return { ...prev, [field]: value };
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form || !transaction) return;

      const normalizedAmount = normalizeAmount(form.amount);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        setError('Nominal harus lebih dari 0.');
        return;
      }

      if (form.type !== 'transfer' && !form.category_id) {
        setError('Kategori wajib dipilih untuk transaksi ini.');
        return;
      }

      if (form.type === 'transfer' && !form.to_account_id) {
        setError('Pilih akun tujuan untuk transfer.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      const payload: UpdateTransactionPayload = {
        date: form.date,
        type: form.type,
        amount: normalizedAmount,
        title: form.title || null,
        notes: form.notes || null,
        account_id: form.account_id || null,
        to_account_id: form.type === 'transfer' ? form.to_account_id || null : null,
        category_id: form.type === 'transfer' ? null : form.category_id,
      };

      try {
        const updated = await updateTransaction(transaction.id, payload);
        toast?.addToast?.('Transaksi berhasil diperbarui', 'success');
        onSaved?.(updated);
      } catch (err) {
        console.error('[transactions:update] Failed to update transaction', err);
        setError('Gagal menyimpan perubahan. Silakan coba lagi.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, onSaved, toast, transaction],
  );

  const handleCancel = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onCancel();
    },
    [onCancel],
  );

  const categoryWarning = useMemo(() => {
    if (!form || form.type === 'transfer') return null;
    if (!form.category_id) return 'Pilih kategori untuk transaksi ini.';
    const exists = categoryOptions.some((category) => category.id === form.category_id);
    if (exists) return null;
    return 'Kategori ini sudah tidak tersedia. Silakan pilih kategori lain.';
  }, [categoryOptions, form]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-5 w-48 animate-pulse rounded bg-surface-dark/40" />
        <div className="h-10 w-full animate-pulse rounded bg-surface-dark/40" />
        <div className="h-24 w-full animate-pulse rounded bg-surface-dark/40" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{error ?? 'Transaksi tidak ditemukan.'}</p>
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={onCancel}>
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <div className="rounded border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Tanggal
          <input
            type="date"
            className="input"
            value={form.date ?? ''}
            onChange={(event) => handleChange('date', event.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Tipe
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={clsx('btn flex-1', {
                  'btn-primary': form.type === option.value,
                  'btn-ghost': form.type !== option.value,
                })}
                onClick={() => handleChange('type', option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </label>
      </div>

      {form.type !== 'transfer' && (
        <label className="flex flex-col gap-1 text-sm text-muted">
          Kategori
          <select
            className="input"
            value={form.category_id ?? ''}
            onChange={(event) => handleChange('category_id', event.target.value)}
          >
            <option value="">Pilih kategori</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {appendedCategorySet.has(category.id) ? ' (arsip)' : ''}
              </option>
            ))}
          </select>
          {isCategoryLoading && <span className="text-xs text-muted">Memuat kategori...</span>}
          {categoryWarning && <span className="text-xs text-danger">{categoryWarning}</span>}
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm text-muted">
        Nominal
        <input
          type="text"
          className="input"
          inputMode="decimal"
          value={form.amount}
          onChange={(event) => handleChange('amount', event.target.value)}
          placeholder="Masukkan nominal"
        />
        <span className="text-xs text-muted">
          {form.amount.trim()
            ? formatCurrency(normalizeAmount(form.amount))
            : 'Masukkan nominal dalam Rupiah'}
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Akun
          <select
            className="input"
            value={form.account_id ?? ''}
            onChange={(event) => handleChange('account_id', event.target.value)}
          >
            <option value="">Pilih akun</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        {form.type === 'transfer' && (
          <label className="flex flex-col gap-1 text-sm text-muted">
            Ke Akun
            <select
              className="input"
              value={form.to_account_id ?? ''}
              onChange={(event) => handleChange('to_account_id', event.target.value)}
            >
              <option value="">Pilih akun tujuan</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Judul
        <input
          type="text"
          className="input"
          value={form.title}
          onChange={(event) => handleChange('title', event.target.value)}
          placeholder="Contoh: Belanja bulanan"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Catatan
        <textarea
          className="input"
          rows={4}
          value={form.notes}
          onChange={(event) => handleChange('notes', event.target.value)}
          placeholder="Tambahkan catatan jika perlu"
        />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          Ingin menambah kategori baru?{' '}
          <Link className="text-primary underline" to="/categories" onClick={onCancel}>
            Kelola kategori
          </Link>
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={isSubmitting}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </div>
    </form>
  );
}
