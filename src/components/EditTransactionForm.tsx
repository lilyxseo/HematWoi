import { useEffect, useMemo, useState } from 'react';
import type { AccountRecord } from '../lib/api';
import Input from './ui/Input';
import Select from './ui/Select';
import Segmented from './ui/Segmented';
import Textarea from './ui/Textarea';
import useCategoriesForEdit from '../hooks/useCategoriesForEdit';
import {
  getTransactionById,
  updateTransaction,
  type Tx,
  type UpdateTransactionPayload,
} from '../services/transactions';

type EditTransactionFormProps = {
  open: boolean;
  transactionId: string | null;
  accounts: AccountRecord[];
  onCancel: () => void;
  onSaved: (transaction: Tx) => void;
};

type FormState = {
  date: string;
  type: 'income' | 'expense' | 'transfer';
  category_id: string | null;
  amount: string;
  account_id: string | null;
  to_account_id: string | null;
  title: string;
  notes: string;
};

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
] as const;

const EMPTY_FORM: FormState = {
  date: '',
  type: 'expense',
  category_id: null,
  amount: '',
  account_id: null,
  to_account_id: null,
  title: '',
  notes: '',
};

function sanitizeAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(/,/g, '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function mapTransactionToForm(tx: Tx): FormState {
  return {
    date: tx.date ?? '',
    type: tx.type,
    category_id: tx.type === 'transfer' ? null : tx.category_id,
    amount: tx.amount != null ? String(tx.amount) : '',
    account_id: tx.account_id,
    to_account_id: tx.to_account_id,
    title: tx.title ?? '',
    notes: tx.notes ?? '',
  };
}

export default function EditTransactionForm({
  open,
  transactionId,
  accounts,
  onCancel,
  onSaved,
}: EditTransactionFormProps) {
  const [formState, setFormState] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const txType = formState.type;

  const { options: categoryOptions, isLoading: categoriesLoading } = useCategoriesForEdit(
    open ? txType : 'transfer',
    formState.category_id ?? undefined,
    {
      enabled: open && (txType === 'income' || txType === 'expense'),
    },
  );

  useEffect(() => {
    if (!open) {
      setFormState(EMPTY_FORM);
      setLoadError(null);
      setFormError(null);
      return;
    }

    if (!transactionId) {
      setLoadError('Transaksi tidak ditemukan.');
      setFormState(EMPTY_FORM);
      return;
    }

    let active = true;
    setIsLoading(true);
    setLoadError(null);
    getTransactionById(transactionId)
      .then((tx) => {
        if (!active) return;
        if (!tx) {
          setLoadError('Transaksi tidak ditemukan.');
          setFormState(EMPTY_FORM);
          return;
        }
        setFormState(mapTransactionToForm(tx));
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Gagal memuat data transaksi.';
        setLoadError(message);
        setFormState(EMPTY_FORM);
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, transactionId]);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
    }
  }, [open]);

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ value: account.id, label: account.name })),
    [accounts],
  );

  const selectedCategory = useMemo(
    () => categoryOptions.find((item) => item.id === formState.category_id) ?? null,
    [categoryOptions, formState.category_id],
  );

  const categorySelectOptions = useMemo(() => {
    if (txType === 'transfer') {
      return [] as { value: string; label: string }[];
    }
    return categoryOptions.map((category) => ({
      value: category.id,
      label:
        category.type !== txType
          ? `${category.name} (Arsip)`
          : category.name,
    }));
  }, [categoryOptions, txType]);

  const showCategoryEmptyState =
    open &&
    (txType === 'income' || txType === 'expense') &&
    !categoriesLoading &&
    categorySelectOptions.length === 0;

  const handleTypeChange = (nextType: string) => {
    if (nextType !== 'income' && nextType !== 'expense' && nextType !== 'transfer') {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      type: nextType,
      category_id: nextType === 'transfer' ? null : prev.category_id,
      to_account_id: nextType === 'transfer' ? prev.to_account_id : null,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!transactionId) {
      setFormError('Transaksi tidak ditemukan.');
      return;
    }
    setFormError(null);

    if (!formState.date) {
      setFormError('Tanggal wajib diisi.');
      return;
    }

    const parsedAmount = sanitizeAmount(formState.amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError('Nominal harus lebih dari 0.');
      return;
    }

    if (!formState.account_id) {
      setFormError('Pilih akun sumber terlebih dahulu.');
      return;
    }

    if (formState.type !== 'transfer' && !formState.category_id) {
      setFormError('Pilih kategori untuk transaksi ini.');
      return;
    }

    if (formState.type === 'transfer') {
      if (!formState.to_account_id) {
        setFormError('Pilih akun tujuan untuk transfer.');
        return;
      }
      if (formState.account_id === formState.to_account_id) {
        setFormError('Akun sumber dan tujuan tidak boleh sama.');
        return;
      }
    }

    const payload: UpdateTransactionPayload = {
      date: formState.date,
      type: formState.type,
      category_id: formState.type === 'transfer' ? null : formState.category_id,
      amount: parsedAmount,
      title: formState.title.trim() ? formState.title.trim() : null,
      notes: formState.notes.trim() ? formState.notes.trim() : null,
      account_id: formState.account_id,
      to_account_id: formState.type === 'transfer' ? formState.to_account_id : null,
    };

    setIsSubmitting(true);
    try {
      const updated = await updateTransaction(transactionId, payload);
      onSaved(updated);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Gagal menyimpan perubahan.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-32 animate-pulse rounded bg-surface-alt" />
        <div className="h-10 w-full animate-pulse rounded-2xl bg-surface-alt" />
        <div className="h-10 w-full animate-pulse rounded-2xl bg-surface-alt" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-surface-alt" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">
          {loadError}
        </p>
        <div className="flex justify-end">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-3">
        <Input
          label="Tanggal"
          type="date"
          required
          value={formState.date}
          onChange={(event) =>
            setFormState((prev) => ({ ...prev, date: event.target.value }))
          }
          disabled={isSubmitting}
        />
        <div className="space-y-2">
          <label className="form-label">Tipe transaksi</label>
          <Segmented
            value={txType}
            onChange={handleTypeChange}
            options={TYPE_OPTIONS}
          />
        </div>

        {txType !== 'transfer' ? (
          <Select
            label="Kategori"
            value={formState.category_id ?? ''}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                category_id: event.target.value ? event.target.value : null,
              }))
            }
            options={categorySelectOptions}
            placeholder={categoriesLoading ? 'Memuat kategori…' : 'Pilih kategori'}
            disabled={isSubmitting || categoriesLoading}
            helper={
              selectedCategory && selectedCategory.type !== txType
                ? 'Kategori ini tidak lagi tersedia untuk tipe ini.'
                : undefined
            }
          />
        ) : null}

        {showCategoryEmptyState ? (
          <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Kategori tidak ditemukan. Coba ubah tipe atau tambah kategori baru.
          </p>
        ) : null}

        <Input
          label="Jumlah"
          value={formState.amount}
          onChange={(event) =>
            setFormState((prev) => ({ ...prev, amount: event.target.value }))
          }
          inputMode="decimal"
          required
          disabled={isSubmitting}
        />

        <Select
          label={txType === 'transfer' ? 'Dari akun' : 'Akun'}
          value={formState.account_id ?? ''}
          onChange={(event) =>
            setFormState((prev) => ({
              ...prev,
              account_id: event.target.value ? event.target.value : null,
            }))
          }
          options={accountOptions}
          placeholder="Pilih akun"
          disabled={isSubmitting}
        />

        {txType === 'transfer' ? (
          <Select
            label="Ke akun"
            value={formState.to_account_id ?? ''}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                to_account_id: event.target.value ? event.target.value : null,
              }))
            }
            options={accountOptions}
            placeholder="Pilih akun tujuan"
            disabled={isSubmitting}
          />
        ) : null}

        <Input
          label="Judul"
          value={formState.title}
          onChange={(event) =>
            setFormState((prev) => ({ ...prev, title: event.target.value }))
          }
          disabled={isSubmitting}
        />

        <Textarea
          label="Catatan"
          value={formState.notes}
          onChange={(event) =>
            setFormState((prev) => ({ ...prev, notes: event.target.value }))
          }
          disabled={isSubmitting}
        />
      </div>

      {formError ? (
        <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Batalkan
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Menyimpan…' : 'Simpan perubahan'}
        </button>
      </div>
    </form>
  );
}
