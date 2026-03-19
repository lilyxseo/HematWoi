import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import Modal from './Modal.jsx';
import type { Tx } from '../services/transactions';
import { getTransactionById, updateTransaction } from '../services/transactions';
import type { AccountRecord } from '../lib/api';
import useCategoriesForEdit from '../hooks/useCategoriesForEdit';

export type TransactionFormValues = {
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
  transactionId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (updated: Tx) => void;
  accounts: AccountRecord[];
};

const TYPE_OPTIONS: { value: Tx['type']; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

const AMOUNT_FORMATTER =
  typeof Intl !== 'undefined'
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })
    : null;

function formatAmountPreview(raw: string): string {
  if (!raw) return 'Rp 0';
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return raw;
  }
  if (AMOUNT_FORMATTER) {
    return AMOUNT_FORMATTER.format(numeric);
  }
  return `Rp ${numeric.toLocaleString('id-ID')}`;
}

function normalizeAmount(value: string): number {
  const sanitized = value.replace(/[^0-9.,-]/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(sanitized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

const INITIAL_FORM: TransactionFormValues = {
  date: '',
  type: 'expense',
  category_id: null,
  amount: '',
  account_id: null,
  to_account_id: null,
  title: '',
  notes: '',
};

export default function EditTransactionForm({
  transactionId,
  open,
  onClose,
  onSaved,
  accounts,
}: EditTransactionFormProps) {
  const [form, setForm] = useState<TransactionFormValues>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [categoryMismatch, setCategoryMismatch] = useState(false);

  const {
    options: categoryOptions,
    isLoading: categoriesLoading,
    error: categoriesError,
    ensureSelectedLoaded,
  } = useCategoriesForEdit(form.type, form.category_id ?? undefined);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setLoadError(null);
      setSaveError(null);
      return;
    }
    if (!transactionId) {
      setForm(INITIAL_FORM);
      setLoadError('Transaksi tidak ditemukan.');
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    setCategoryMismatch(false);

    void getTransactionById(transactionId)
      .then((tx) => {
        if (!active) return;
        if (!tx) {
          setLoadError('Transaksi tidak ditemukan.');
          return;
        }
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
      })
      .catch((error) => {
        if (!active) return;
        console.error('[transactions:list] Failed to load transaction for edit', error);
        setLoadError('Gagal memuat transaksi. Silakan coba lagi.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, transactionId]);

  useEffect(() => {
    if (!open) return;
    if (!form.category_id) return;
    void ensureSelectedLoaded();
  }, [open, form.category_id, ensureSelectedLoaded]);

  const accountOptions = useMemo(() => {
    return accounts.map((account) => ({ value: account.id, label: account.name || 'Tanpa nama' }));
  }, [accounts]);

  const selectedCategoryMissing = useMemo(() => {
    if (!form.category_id) return false;
    if (form.type === 'transfer') return false;
    return !categoryOptions.some((item) => item.id === form.category_id);
  }, [categoryOptions, form.category_id, form.type]);

  useEffect(() => {
    if (selectedCategoryMissing) {
      setCategoryMismatch(true);
    }
  }, [selectedCategoryMissing]);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      if (name === 'category_id') {
        setCategoryMismatch(false);
      }
    },
    [],
  );

  const handleSelectChange = useCallback((name: keyof TransactionFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value || null }));
    if (name === 'category_id') {
      setCategoryMismatch(false);
    }
  }, []);

  const handleTypeChange = useCallback((value: Tx['type']) => {
    setForm((prev) => {
      if (value === prev.type) {
        return prev;
      }
      if (value === 'transfer') {
        return { ...prev, type: value, category_id: null };
      }
      const next: TransactionFormValues = {
        ...prev,
        type: value,
      };
      if (prev.category_id && prev.type !== value) {
        next.category_id = null;
        setCategoryMismatch(true);
      }
      if (value !== 'transfer') {
        next.to_account_id = null;
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!transactionId) {
        setSaveError('Transaksi tidak ditemukan.');
        return;
      }
      if (!form.date) {
        setSaveError('Tanggal wajib diisi.');
        return;
      }
      const amountValue = normalizeAmount(form.amount);
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setSaveError('Nominal harus lebih besar dari 0.');
        return;
      }
      if (form.type !== 'transfer' && !form.category_id) {
        setSaveError('Pilih kategori untuk transaksi ini.');
        return;
      }
      if (!form.account_id) {
        setSaveError('Pilih akun sumber transaksi.');
        return;
      }
      if (form.type === 'transfer' && !form.to_account_id) {
        setSaveError('Pilih akun tujuan untuk transfer.');
        return;
      }
      if (
        form.type === 'transfer' &&
        form.account_id &&
        form.to_account_id &&
        form.account_id === form.to_account_id
      ) {
        setSaveError('Akun sumber dan tujuan tidak boleh sama.');
        return;
      }

      setSaveError(null);
      setSaving(true);

      try {
        const payload = {
          date: form.date,
          type: form.type,
          category_id: form.type === 'transfer' ? null : form.category_id,
          amount: amountValue,
          account_id: form.account_id,
          to_account_id: form.type === 'transfer' ? form.to_account_id : null,
          title: form.title.trim() ? form.title.trim() : null,
          notes: form.notes.trim() ? form.notes.trim() : null,
        } satisfies Partial<Tx>;

        const updated = await updateTransaction(transactionId, payload);
        if (onSaved) {
          onSaved(updated);
        }
        onClose();
      } catch (error) {
        console.error('[transactions:update] Failed to update transaction', error);
        setSaveError('Gagal menyimpan transaksi. Silakan coba lagi.');
      } finally {
        setSaving(false);
      }
    },
    [form, onClose, onSaved, transactionId],
  );

  const categoryFieldDisabled = form.type === 'transfer';

  return (
    <Modal open={open} title="Edit Transaksi" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {loadError ? (
          <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/40">
            {loadError}
          </div>
        ) : null}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            <span>Tanggal</span>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={(event) => handleInputChange(event)}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              required
            />
          </label>
          <div className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            <span>Tipe</span>
            <div className="inline-flex overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
              {TYPE_OPTIONS.map((option) => {
                const selected = form.type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleTypeChange(option.value)}
                    className={clsx(
                      'flex-1 px-3 py-2 text-sm font-semibold transition',
                      selected
                        ? 'bg-primary/90 text-white'
                        : 'bg-transparent text-slate-300 hover:bg-slate-800',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            <span>Akun</span>
            <select
              name="account_id"
              value={form.account_id ?? ''}
              onChange={(event) => handleSelectChange('account_id', event.target.value)}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              required
            >
              <option value="">Pilih akun</option>
              {accountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {form.type === 'transfer' ? (
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
              <span>Ke Akun</span>
              <select
                name="to_account_id"
                value={form.to_account_id ?? ''}
                onChange={(event) => handleSelectChange('to_account_id', event.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                required
              >
                <option value="">Pilih akun tujuan</option>
                {accountOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
              <span>Kategori</span>
              <select
                name="category_id"
                value={form.category_id ?? ''}
                onChange={(event) => handleSelectChange('category_id', event.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                disabled={categoryFieldDisabled}
                required
              >
                <option value="">Pilih kategori</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {categoriesLoading ? (
                <p className="text-xs text-slate-400">Memuat kategori…</p>
              ) : null}
              {!categoriesLoading && categoryOptions.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Kategori tidak ditemukan. Coba ubah tipe atau tambah kategori.
                </p>
              ) : null}
              {selectedCategoryMissing ? (
                <p className="text-xs text-amber-300">
                  Kategori sebelumnya tidak tersedia. Silakan pilih kategori yang cocok.
                </p>
              ) : null}
              {categoryMismatch && !form.category_id ? (
                <p className="text-xs text-amber-300">
                  Pilih kategori baru setelah mengubah tipe transaksi.
                </p>
              ) : null}
              {categoriesError ? (
                <p className="text-xs text-red-300">{categoriesError.message}</p>
              ) : null}
            </label>
          )}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            <span>Nominal</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="amount"
              value={form.amount}
              onChange={(event) => handleInputChange(event)}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              placeholder="0"
              required
            />
            <p className="text-xs text-slate-400">{formatAmountPreview(form.amount)}</p>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
            <span>Judul</span>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={(event) => handleInputChange(event)}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              placeholder="Cth: Belanja harian"
            />
          </label>
        </fieldset>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
          <span>Catatan</span>
          <textarea
            name="notes"
            value={form.notes}
            onChange={(event) => handleInputChange(event)}
            className="min-h-[96px] rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            placeholder="Tambahkan catatan (opsional)"
          />
        </label>

        {saveError ? (
          <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/40">
            {saveError}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            disabled={saving}
          >
            Batalkan
          </button>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={saving || loading}
          >
            {saving ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

