import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal.jsx';
import Input from './ui/Input.jsx';
import Select from './ui/Select.jsx';
import Textarea from './ui/Textarea.jsx';
import CurrencyInput from './ui/CurrencyInput.jsx';
import Segmented from './ui/Segmented.jsx';
import type { AccountRecord } from '../lib/api';
import { formatCurrency } from '../lib/format';
import useCategoriesForEdit from '../hooks/useCategoriesForEdit';
import {
  getTransactionById,
  updateTransaction,
  type Tx,
  type UpdateTransactionPayload,
} from '../services/transactions';

type TransactionType = Tx['type'];

interface EditTransactionFormProps {
  open: boolean;
  transactionId: string | null;
  accounts: AccountRecord[];
  onClose: () => void;
  onSaved?: (transaction: Tx) => void;
}

interface FormState {
  date: string;
  type: TransactionType;
  categoryId: string | null;
  amount: number;
  accountId: string | null;
  toAccountId: string | null;
  title: string;
  notes: string;
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default function EditTransactionForm({
  open,
  transactionId,
  accounts,
  onClose,
  onSaved,
}: EditTransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);

  const txType: TransactionType = formState?.type ?? 'expense';
  const selectedCategoryId = formState?.categoryId ?? null;

  const categories = useCategoriesForEdit(txType, selectedCategoryId, {
    enabled: open && (txType === 'expense' || txType === 'income'),
  });

  useEffect(() => {
    if (!open) {
      setFormState(null);
      setFormError(null);
      setFieldErrors({});
      setCategoryNotice(null);
      return;
    }
    if (!transactionId) {
      setFormState(null);
      return;
    }
    setLoading(true);
    setFormError(null);
    setFieldErrors({});
    setCategoryNotice(null);

    void getTransactionById(transactionId)
      .then((tx) => {
        if (!tx) {
          setFormState(null);
          setFormError('Transaksi tidak ditemukan.');
          return;
        }
        setFormState({
          date: tx.date ?? '',
          type: tx.type,
          categoryId: tx.category_id,
          amount: Number(tx.amount ?? 0),
          accountId: tx.account_id,
          toAccountId: tx.to_account_id,
          title: normalizeText(tx.title),
          notes: normalizeText(tx.notes),
        });
      })
      .catch((error) => {
        console.error('[transactions:update] Failed to load transaction', error);
        setFormError('Gagal memuat transaksi. Silakan coba lagi.');
        setFormState(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, transactionId]);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name ?? '(Tanpa nama)',
      })),
    [accounts],
  );

  const categoryOptions = useMemo(() => {
    if (txType === 'transfer') {
      return [];
    }
    return categories.options
      .filter((item) => item.type === txType || categories.archivedCategoryIds.has(item.id))
      .map((item) => ({
        value: item.id,
        label: categories.archivedCategoryIds.has(item.id) ? `${item.name} (arsip)` : item.name,
      }));
  }, [categories.archivedCategoryIds, categories.options, txType]);

  const categoryHelper = useMemo(() => {
    if (txType === 'transfer') {
      return null;
    }
    if (categories.isLoading) {
      return 'Memuat kategori...';
    }
    if (!categoryOptions.length) {
      return 'Kategori tidak ditemukan. Coba ubah tipe atau tambah kategori.';
    }
    if (selectedCategoryId && categories.archivedCategoryIds.has(selectedCategoryId)) {
      return 'Kategori ini sudah tidak aktif. Anda masih bisa menyimpan atau pilih kategori lain.';
    }
    return categoryNotice;
  }, [categories.archivedCategoryIds, categories.isLoading, categoryNotice, categoryOptions.length, selectedCategoryId, txType]);

  const validate = useCallback((): boolean => {
    if (!formState) {
      return false;
    }
    const errors: Record<string, string> = {};
    if (!formState.date) {
      errors.date = 'Tanggal wajib diisi.';
    }
    if (formState.type !== 'transfer') {
      if (!formState.categoryId) {
        errors.categoryId = 'Kategori wajib diisi.';
      }
    }
    if (!formState.accountId) {
      errors.accountId = 'Akun wajib diisi.';
    }
    if (formState.type === 'transfer' && !formState.toAccountId) {
      errors.toAccountId = 'Akun tujuan wajib diisi.';
    }
    if (!formState.amount || Number(formState.amount) <= 0) {
      errors.amount = 'Nominal harus lebih dari 0.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formState]);

  const handleTypeChange = useCallback(
    (nextType: TransactionType) => {
      if (!formState) return;
      if (formState.type === nextType) return;
      let notice: string | null = null;
      let nextCategoryId = formState.categoryId;
      if (nextType === 'transfer') {
        nextCategoryId = null;
      } else if (formState.categoryId) {
        const existing = categories.options.find((item) => item.id === formState.categoryId);
        if (existing && existing.type !== nextType) {
          nextCategoryId = null;
          notice = 'Kategori sebelumnya tidak tersedia untuk tipe ini. Silakan pilih kategori baru.';
        }
      }
      setFormState((prev) =>
        prev
          ? {
              ...prev,
              type: nextType,
              categoryId: nextCategoryId,
              toAccountId: nextType === 'transfer' ? prev.toAccountId : null,
            }
          : prev,
      );
      setFieldErrors((prev) => {
        if (!prev.categoryId) return prev;
        const next = { ...prev };
        delete next.categoryId;
        return next;
      });
      setCategoryNotice(notice);
    },
    [categories.options, formState],
  );

  const handleCategoryChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value ? event.target.value : null;
    setFormState((prev) => (prev ? { ...prev, categoryId: value } : prev));
    setFieldErrors((prev) => {
      if (!prev.categoryId) return prev;
      const next = { ...prev };
      delete next.categoryId;
      return next;
    });
    setCategoryNotice(null);
  }, []);

  const handleAccountChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value ? event.target.value : null;
    setFormState((prev) => (prev ? { ...prev, accountId: value } : prev));
    setFieldErrors((prev) => {
      if (!prev.accountId) return prev;
      const next = { ...prev };
      delete next.accountId;
      return next;
    });
  }, []);

  const handleToAccountChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value ? event.target.value : null;
    setFormState((prev) => (prev ? { ...prev, toAccountId: value } : prev));
    setFieldErrors((prev) => {
      if (!prev.toAccountId) return prev;
      const next = { ...prev };
      delete next.toAccountId;
      return next;
    });
  }, []);

  const handleAmountChange = useCallback((value: number) => {
    setFormState((prev) => (prev ? { ...prev, amount: value } : prev));
    setFieldErrors((prev) => {
      if (!prev.amount) return prev;
      const next = { ...prev };
      delete next.amount;
      return next;
    });
  }, []);

  const handleInputChange = useCallback(
    (field: keyof Pick<FormState, 'title' | 'notes'>, value: string) => {
      setFormState((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    [],
  );

  const handleDateChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormState((prev) => (prev ? { ...prev, date: value } : prev));
    setFieldErrors((prev) => {
      if (!prev.date) return prev;
      const next = { ...prev };
      delete next.date;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!formState || !transactionId || saving) {
        return;
      }
      if (!validate()) {
        return;
      }

      const payload: UpdateTransactionPayload = {
        date: formState.date,
        type: formState.type,
        amount: formState.amount,
        account_id: formState.accountId,
        to_account_id: formState.type === 'transfer' ? formState.toAccountId : null,
        category_id: formState.type === 'transfer' ? null : formState.categoryId,
        title: formState.title.trim() || null,
        notes: formState.notes.trim() || null,
      };

      setSaving(true);
      setFormError(null);
      try {
        const updated = await updateTransaction(transactionId, payload);
        onSaved?.(updated);
      } catch (error) {
        console.error('[transactions:update] Failed to update transaction', error);
        if (error instanceof Error && error.message) {
          setFormError(error.message);
        } else {
          setFormError('Gagal menyimpan perubahan. Silakan coba lagi.');
        }
      } finally {
        setSaving(false);
      }
    },
    [formState, onSaved, saving, transactionId, validate],
  );

  const modalTitle = formState ? 'Edit Transaksi' : 'Memuat Transaksi';

  const amountSummary = useMemo(() => {
    if (!formState) return null;
    return formatCurrency(formState.amount ?? 0);
  }, [formState]);

  return (
    <Modal open={open} title={modalTitle} onClose={onClose}>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : formState ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Segmented value={formState.type} onChange={(value) => handleTypeChange(value as TransactionType)} options={TYPE_OPTIONS} />
          </div>
          <Input
            label="Tanggal"
            type="date"
            value={formState.date}
            onChange={handleDateChange}
            error={fieldErrors.date}
            required
          />
          <CurrencyInput
            label="Jumlah"
            value={formState.amount}
            onChangeNumber={handleAmountChange}
            helper={amountSummary ? `≈ ${amountSummary}` : undefined}
            error={fieldErrors.amount}
          />
          <Select
            label="Akun"
            value={formState.accountId ?? ''}
            onChange={handleAccountChange}
            options={accountOptions}
            placeholder="Pilih akun"
            error={fieldErrors.accountId}
          />
          {formState.type === 'transfer' ? (
            <Select
              label="Ke Akun"
              value={formState.toAccountId ?? ''}
              onChange={handleToAccountChange}
              options={accountOptions}
              placeholder="Pilih akun tujuan"
              error={fieldErrors.toAccountId}
            />
          ) : (
            <Select
              label="Kategori"
              value={formState.categoryId ?? ''}
              onChange={handleCategoryChange}
              options={categoryOptions}
              placeholder="Pilih kategori"
              helper={categoryHelper ?? undefined}
              error={fieldErrors.categoryId}
            />
          )}
          <Input
            label="Judul"
            value={formState.title}
            onChange={(event) => handleInputChange('title', event.target.value)}
            placeholder="Judul transaksi"
          />
          <Textarea
            label="Catatan"
            value={formState.notes}
            onChange={(event) => handleInputChange('notes', event.target.value)}
            placeholder="Catatan tambahan"
          />
          {formError ? <p className="text-sm font-medium text-danger">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {formError ? <p className="text-sm text-danger">{formError}</p> : <p className="text-sm text-muted">Transaksi tidak tersedia.</p>}
          <div className="flex justify-end">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
