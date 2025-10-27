import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import useCategoriesForEdit from '../hooks/useCategoriesForEdit';
import type { CategoryOption } from '../hooks/useCategoriesForEdit';
import { useToast } from '../context/ToastContext.jsx';
import {
  getTransactionById,
  updateTransaction,
  type Tx,
  type UpdateTransactionPayload,
} from '../services/transactions';
import type { AccountRecord } from '../lib/api.ts';

interface EditTransactionFormProps {
  transactionId: string;
  onCancel: () => void;
  onSaved: (tx: Tx) => void;
  accounts: Pick<AccountRecord, 'id' | 'name'>[];
}

type FormState = {
  date: string;
  type: Tx['type'];
  category_id: string | null;
  amount: string;
  account_id: string | null;
  to_account_id: string | null;
  title: string;
  notes: string;
  merchant_id: string | null;
};

const TYPE_OPTIONS: { label: string; value: Tx['type'] }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

function formatCurrencyLocal(value: number): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(value);
  }
}

export default function EditTransactionForm({
  transactionId,
  onCancel,
  onSaved,
  accounts,
}: EditTransactionFormProps) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>({
    date: '',
    type: 'expense',
    category_id: null,
    amount: '',
    account_id: null,
    to_account_id: null,
    title: '',
    notes: '',
    merchant_id: null,
  });
  const categoryHook = useCategoriesForEdit(
    formState.type,
    formState.category_id ?? undefined,
  );

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    if (formState.type === 'transfer') {
      return [];
    }
    return [...categoryHook.options].sort((a, b) => {
      if (Boolean(a.isFallback) !== Boolean(b.isFallback)) {
        return a.isFallback ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categoryHook.options, formState.type]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const transaction = await getTransactionById(transactionId);
        if (!transaction) {
          throw new Error('Transaksi tidak ditemukan.');
        }
        if (cancelled) return;
        setFormState({
          date: transaction.date ?? '',
          type: transaction.type,
          category_id: transaction.category_id,
          amount: Number.isFinite(transaction.amount)
            ? String(transaction.amount)
            : '',
          account_id: transaction.account_id,
          to_account_id: transaction.to_account_id,
          title: transaction.title ?? '',
          notes: transaction.notes ?? '',
          merchant_id: transaction.merchant_id ?? null,
        });
      } catch (error) {
        console.error('[transactions:getById] Failed to load transaction', error);
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : 'Gagal memuat transaksi.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  useEffect(() => {
    if (formState.type === 'transfer') {
      setCategoryWarning(null);
      return;
    }

    if (categoryHook.isLoading) {
      setCategoryWarning(null);
      return;
    }

    if (!formState.category_id) {
      setCategoryWarning(categoryOptions.length ? 'Pilih kategori sesuai tipe transaksi.' : null);
      return;
    }

    const exists = categoryOptions.some((item) => item.id === formState.category_id);
    if (!exists) {
      setFormState((prev) => ({ ...prev, category_id: null }));
      setCategoryWarning('Kategori tidak tersedia untuk tipe ini. Silakan pilih ulang.');
    } else {
      setCategoryWarning(null);
    }
  }, [categoryHook.isLoading, categoryOptions, formState.category_id, formState.type]);

  const handleFieldChange = useCallback(
    <K extends keyof FormState,>(field: K, value: FormState[K]) => {
      setFormState((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const handleAmountChange = useCallback((value: string) => {
    const sanitized = value.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
    handleFieldChange('amount', sanitized);
  }, [handleFieldChange]);

  const handleTypeChange = useCallback(
    (value: Tx['type']) => {
      setFormState((prev) => ({
        ...prev,
        type: value,
        category_id: value === 'transfer' ? null : prev.category_id,
        to_account_id: value === 'transfer' ? prev.to_account_id : null,
      }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!formState.date) {
        setSaveError('Tanggal wajib diisi.');
        return;
      }
      const parsedAmount = Number(formState.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setSaveError('Nominal harus lebih dari 0.');
        return;
      }
      if (formState.type !== 'transfer' && !formState.category_id) {
        setSaveError('Kategori wajib dipilih.');
        return;
      }
      if (!formState.account_id) {
        setSaveError('Akun wajib dipilih.');
        return;
      }
      if (formState.type === 'transfer' && !formState.to_account_id) {
        setSaveError('Akun tujuan wajib dipilih untuk transfer.');
        return;
      }

      setSaveError(null);
      setIsSaving(true);
      try {
        const payload: UpdateTransactionPayload = {
          date: formState.date,
          type: formState.type,
          category_id: formState.type === 'transfer' ? null : formState.category_id,
          amount: parsedAmount,
          title: formState.title ? formState.title.trim() : null,
          notes: formState.notes ? formState.notes.trim() : null,
          account_id: formState.account_id,
          to_account_id: formState.type === 'transfer' ? formState.to_account_id : null,
          merchant_id: formState.merchant_id,
        };

        const updated = await updateTransaction(transactionId, payload);
        toast?.addToast?.('Transaksi berhasil diperbarui.', 'success');
        onSaved(updated);
      } catch (error) {
        console.error('[transactions:update] Failed to save transaction', error);
        setSaveError(error instanceof Error ? error.message : 'Gagal menyimpan transaksi.');
      } finally {
        setIsSaving(false);
      }
    },
    [formState, onSaved, toast, transactionId],
  );

  const renderCategoryOption = useCallback((option: CategoryOption) => {
    const label = option.isFallback ? `${option.name} (arsip)` : option.name;
    return (
      <option key={option.id} value={option.id}>
        {label}
      </option>
    );
  }, []);

  const amountPreview = useMemo(() => {
    const amount = Number(formState.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return '';
    }
    return formatCurrencyLocal(amount);
  }, [formState.amount]);

  return (
    <form className="flex h-full flex-col gap-6 overflow-y-auto p-6" onSubmit={handleSubmit}>
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Edit Transaksi</h2>
        <p className="text-sm text-muted-foreground">Perbarui detail transaksi dan pastikan kategori sesuai.</p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
        </div>
      ) : loadError ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Tanggal
              <input
                type="date"
                value={formState.date}
                onChange={(event) => handleFieldChange('date', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-base"
                required
              />
            </label>

            <div className="flex flex-col gap-2 text-sm font-medium">
              Tipe Transaksi
              <div className="flex gap-2">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleTypeChange(option.value)}
                    className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition ${
                      formState.type === option.value
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {formState.type !== 'transfer' && (
              <label className="flex flex-col gap-2 text-sm font-medium">
                Kategori
                {categoryHook.isLoading ? (
                  <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
                ) : categoryOptions.length ? (
                  <select
                    value={formState.category_id ?? ''}
                    onChange={(event) => handleFieldChange('category_id', event.target.value || null)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-base"
                    required
                  >
                    <option value="">Pilih kategori</option>
                    {categoryOptions.map(renderCategoryOption)}
                  </select>
                ) : (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Kategori tidak ditemukan. Coba ubah tipe atau tambah kategori baru.
                  </div>
                )}
                {categoryWarning && (
                  <p className="text-xs text-amber-600">{categoryWarning}</p>
                )}
              </label>
            )}

            <label className="flex flex-col gap-2 text-sm font-medium">
              Nominal
              <input
                type="text"
                inputMode="decimal"
                value={formState.amount}
                onChange={(event) => handleAmountChange(event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-base"
                required
              />
              {amountPreview && (
                <span className="text-xs text-muted-foreground">{amountPreview}</span>
              )}
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Akun
              <select
                value={formState.account_id ?? ''}
                onChange={(event) => handleFieldChange('account_id', event.target.value || null)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-base"
                required
              >
                <option value="">Pilih akun</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            {formState.type === 'transfer' && (
              <label className="flex flex-col gap-2 text-sm font-medium">
                Ke Akun
                <select
                  value={formState.to_account_id ?? ''}
                  onChange={(event) => handleFieldChange('to_account_id', event.target.value || null)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-base"
                  required
                >
                  <option value="">Pilih akun tujuan</option>
                  {accounts
                    .filter((account) => account.id !== formState.account_id)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-2 text-sm font-medium">
              Judul
              <input
                type="text"
                value={formState.title}
                onChange={(event) => handleFieldChange('title', event.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-base"
                placeholder="Contoh: Belanja mingguan"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Catatan
              <textarea
                value={formState.notes}
                onChange={(event) => handleFieldChange('notes', event.target.value)}
                className="min-h-[100px] w-full rounded border border-gray-300 px-3 py-2 text-base"
                placeholder="Detail tambahan"
              />
            </label>
          </div>
        </div>
      )}

      {saveError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <footer className="mt-auto flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          disabled={isSaving}
        >
          Batalkan
        </button>
        <button
          type="submit"
          className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving || isLoading}
        >
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </footer>
    </form>
  );
}
