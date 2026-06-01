import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import Input from './ui/Input.jsx';
import Select from './ui/Select.jsx';
import Textarea from './ui/Textarea.jsx';
import type { AccountRecord } from '../lib/api';
import useSupabaseUser from '../hooks/useSupabaseUser';
import { useCategoriesForEdit } from '../hooks/useCategoriesForEdit';
import {
  getTransactionById,
  updateTransaction,
  type Tx,
  type UpdateTransactionInput,
} from '../services/transactions';

type EditTransactionFormProps = {
  transactionId: string;
  accounts: AccountRecord[];
  onCancel: () => void;
  onSuccess: (tx: Tx) => void;
};

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

const TYPE_OPTIONS: { value: Tx['type']; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

function toFormState(tx: Tx): FormState {
  return {
    date: tx.date ?? '',
    type: tx.type,
    category_id: tx.category_id,
    amount: Number.isFinite(tx.amount) ? String(tx.amount) : '',
    account_id: tx.account_id,
    to_account_id: tx.to_account_id,
    title: tx.title ?? '',
    notes: tx.notes ?? '',
  };
}

export default function EditTransactionForm({
  transactionId,
  accounts,
  onCancel,
  onSuccess,
}: EditTransactionFormProps) {
  const { user, loading: userLoading } = useSupabaseUser();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialTx, setInitialTx] = useState<Tx | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [typeChanged, setTypeChanged] = useState(false);
  const [categoryHint, setCategoryHint] = useState<string | null>(null);

  const loadTransaction = useCallback(async () => {
    if (!transactionId) {
      setLoadError('ID transaksi tidak valid.');
      setIsLoading(false);
      return;
    }
    if (userLoading) {
      return;
    }
    if (!user) {
      setLoadError('Session berakhir. Silakan login kembali.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setSubmitError(null);
    setTypeChanged(false);
    setCategoryHint(null);

    try {
      const tx = await getTransactionById(transactionId);
      if (!tx) {
        setInitialTx(null);
        setFormState(null);
        setLoadError('Transaksi tidak ditemukan.');
        return;
      }
      setInitialTx(tx);
      setFormState(toFormState(tx));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal memuat transaksi. Coba lagi.';
      setLoadError(message);
      setInitialTx(null);
      setFormState(null);
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, user, userLoading]);

  useEffect(() => {
    void loadTransaction();
  }, [loadTransaction]);

  const categoryEnabled = Boolean(
    formState && !userLoading && user && formState.type !== 'transfer',
  );

  const {
    options: categoryOptions,
    isLoading: categoriesLoading,
    ensureSelectedLoaded,
  } = useCategoriesForEdit(formState?.type ?? 'expense', formState?.category_id ?? undefined, {
    enabled: categoryEnabled,
  });

  useEffect(() => {
    if (!formState || !initialTx) return;
    if (!initialTx.category_id) return;
    if (formState.type === 'transfer') return;
    if (!categoryEnabled) return;
    void ensureSelectedLoaded(initialTx.category_id);
  }, [categoryEnabled, ensureSelectedLoaded, formState, initialTx]);

  useEffect(() => {
    if (!formState) return;
    if (!typeChanged) {
      setCategoryHint(null);
      return;
    }
    if (formState.type === 'transfer') {
      setCategoryHint(null);
      return;
    }
    if (categoriesLoading) {
      return;
    }
    if (!formState.category_id) {
      setCategoryHint('Kategori tidak cocok dengan tipe baru. Pilih kategori lain.');
      return;
    }
    const exists = categoryOptions.some((cat) => cat.id === formState.category_id);
    if (!exists) {
      setFormState((prev) => (prev ? { ...prev, category_id: null } : prev));
      setCategoryHint('Kategori tidak tersedia untuk tipe ini. Pilih kategori lain.');
    } else {
      setCategoryHint(null);
    }
  }, [categoriesLoading, categoryOptions, formState, typeChanged]);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name?.trim() ? account.name : 'Tanpa nama',
      })),
    [accounts],
  );

  const categorySelectOptions = useMemo(() => {
    if (!formState) return [];
    return categoryOptions.map((category) => ({
      value: category.id,
      label:
        category.type === formState.type ? category.name : `${category.name} (arsip)`,
    }));
  }, [categoryOptions, formState]);

  const selectedCategory = useMemo(() => {
    if (!formState?.category_id) return null;
    return categoryOptions.find((category) => category.id === formState.category_id) ?? null;
  }, [categoryOptions, formState]);

  const selectedCategoryMismatch = Boolean(
    selectedCategory && formState && selectedCategory.type !== formState.type,
  );

  const handleTypeChange = (nextType: Tx['type']) => {
    if (!formState || formState.type === nextType) return;
    setFormState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        type: nextType,
        category_id: null,
        to_account_id: nextType === 'transfer' ? prev.to_account_id ?? null : null,
      };
    });
    setTypeChanged(nextType !== initialTx?.type);
    if (nextType === 'transfer') {
      setCategoryHint(null);
    } else {
      setCategoryHint('Kategori tidak cocok dengan tipe baru. Pilih kategori lain.');
    }
    setSubmitError(null);
  };

  const handleFieldChange = <T extends keyof FormState>(field: T) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormState((prev) =>
        prev
          ? {
              ...prev,
              [field]: event.target.value,
            }
          : prev,
      );
      if (field === 'category_id') {
        setCategoryHint(null);
      }
      if (submitError) {
        setSubmitError(null);
      }
    };

  const isTransfer = formState?.type === 'transfer';

  const isSubmitDisabled = useMemo(() => {
    if (!formState) return true;
    if (!formState.date || !formState.amount.trim()) return true;
    if (!Number.isFinite(Number.parseFloat(formState.amount))) return true;
    if (!formState.account_id) return true;
    if (!isTransfer && !formState.category_id) return true;
    if (isTransfer) {
      if (!formState.to_account_id) return true;
      if (formState.account_id === formState.to_account_id) return true;
    }
    return false;
  }, [formState, isTransfer]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState || saving) return;

    const amountValue = Number.parseFloat(formState.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setSubmitError('Jumlah harus lebih besar dari 0.');
      return;
    }
    if (!formState.account_id) {
      setSubmitError('Pilih akun sumber.');
      return;
    }
    if (!isTransfer && !formState.category_id) {
      setSubmitError('Kategori wajib dipilih.');
      return;
    }
    if (isTransfer) {
      if (!formState.to_account_id) {
        setSubmitError('Pilih akun tujuan untuk transfer.');
        return;
      }
      if (formState.account_id === formState.to_account_id) {
        setSubmitError('Akun sumber dan tujuan harus berbeda.');
        return;
      }
    }

    const payload: UpdateTransactionInput = {
      date: formState.date,
      type: formState.type,
      amount: amountValue,
      account_id: formState.account_id,
      to_account_id: isTransfer ? formState.to_account_id : null,
      category_id: isTransfer ? null : formState.category_id,
      title: formState.title.trim() || null,
      notes: formState.notes.trim() || null,
    };

    setSaving(true);
    setSubmitError(null);
    try {
      const updated = await updateTransaction(transactionId, payload);
      setInitialTx(updated);
      setFormState(toFormState(updated));
      setTypeChanged(false);
      setCategoryHint(null);
      onSuccess(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan transaksi.';
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || userLoading) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-sm text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Memuat transaksi...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {loadError}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Tutup
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void loadTransaction()}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (!formState) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Tanggal"
          type="date"
          value={formState.date}
          onChange={handleFieldChange('date')}
          required
        />
        <div className="space-y-2">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
            Tipe Transaksi
          </span>
          <div className="flex overflow-hidden rounded-2xl border border-border-subtle bg-surface-alt p-1">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={clsx(
                  'flex-1 rounded-2xl px-3 py-2 text-sm font-medium transition',
                  formState.type === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted hover:bg-surface',
                )}
                onClick={() => handleTypeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Jumlah"
          type="number"
          min="0"
          step="0.01"
          value={formState.amount}
          onChange={handleFieldChange('amount')}
          required
        />
        <Select
          label={isTransfer ? 'Dari Akun' : 'Akun'}
          value={formState.account_id ?? ''}
          onChange={handleFieldChange('account_id')}
          options={accountOptions}
          placeholder="Pilih akun"
        />
      </div>

      {isTransfer ? (
        <Select
          label="Ke Akun"
          value={formState.to_account_id ?? ''}
          onChange={handleFieldChange('to_account_id')}
          options={accountOptions}
          placeholder="Pilih akun tujuan"
        />
      ) : (
        <div className="space-y-2">
          <Select
            label="Kategori"
            value={formState.category_id ?? ''}
            onChange={handleFieldChange('category_id')}
            options={categorySelectOptions}
            placeholder={categoriesLoading ? 'Memuat kategori...' : 'Pilih kategori'}
            disabled={!categoryEnabled || categoriesLoading}
          />
          {categoriesLoading ? (
            <p className="text-xs text-muted">Memuat kategori...</p>
          ) : null}
          {!categoriesLoading && categoryEnabled && categoryOptions.length === 0 ? (
            <p className="text-xs font-medium text-muted">
              Kategori tidak ditemukan. Coba ubah tipe atau tambah kategori.
            </p>
          ) : null}
          {categoryHint ? (
            <p className="text-xs font-medium text-amber-400">{categoryHint}</p>
          ) : null}
          {selectedCategoryMismatch ? (
            <p className="text-xs text-muted">
              Kategori saat ini berbeda tipe. Anda masih dapat menyimpannya atau memilih yang lain.
            </p>
          ) : null}
        </div>
      )}

      <Input
        label="Judul"
        value={formState.title}
        onChange={handleFieldChange('title')}
        placeholder="Judul transaksi"
      />

      <Textarea
        label="Catatan"
        value={formState.notes}
        onChange={handleFieldChange('notes')}
        placeholder="Catatan tambahan"
      />

      {submitError ? <p className="text-sm font-medium text-danger">{submitError}</p> : null}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Batal
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving || isSubmitDisabled}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan perubahan'}
        </button>
      </div>
    </form>
  );
}
