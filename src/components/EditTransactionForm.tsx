import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Segmented from './ui/Segmented';
import Input from './ui/Input';
import Select from './ui/Select';
import Textarea from './ui/Textarea';
import type { Tx } from '../services/transactions';
import { getTransactionById, updateTransaction } from '../services/transactions';
import { useCategoriesForEdit } from '../hooks/useCategoriesForEdit';
import type { CategoryOption } from '../hooks/useCategoriesForEdit';
import { fetchAccounts, type Account } from '../services/accounts';

type TxType = 'income' | 'expense' | 'transfer';

type EditTransactionFormProps = {
  transactionId: string;
  onCancel: () => void;
  onSaved: (tx: Tx) => void;
};

type FormState = {
  date: string;
  type: TxType;
  categoryId: string | null;
  amount: string;
  accountId: string | null;
  toAccountId: string | null;
  title: string;
  notes: string;
};

type FormErrors = {
  amount?: string;
  categoryId?: string;
};

const TYPE_OPTIONS: { value: TxType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

function formatAmountInput(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }
  return value.toString();
}

function mapCategoryOptions(options: CategoryOption[]): { value: string; label: string }[] {
  return options
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      value: item.id,
      label: item.isFallback ? `${item.name} (arsip)` : item.name,
    }));
}

export default function EditTransactionForm({ transactionId, onCancel, onSaved }: EditTransactionFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [categoryHint, setCategoryHint] = useState<string | null>(null);
  const [allowFallback, setAllowFallback] = useState(true);
  const originalTypeRef = useRef<TxType | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      setFormErrors({});
      setAllowFallback(true);
      try {
        setAccountsLoading(true);
        const [tx, accountRows] = await Promise.all([
          getTransactionById(transactionId),
          fetchAccounts(),
        ]);
        if (cancelled || !mountedRef.current) {
          return;
        }
        setAccounts(accountRows);
        setAccountsLoading(false);
        if (!tx) {
          setErrorMessage('Transaksi tidak ditemukan.');
          setFormState(null);
          return;
        }
        originalTypeRef.current = tx.type;
        setFormState({
          date: tx.date,
          type: tx.type,
          categoryId: tx.category_id,
          amount: formatAmountInput(tx.amount),
          accountId: tx.account_id,
          toAccountId: tx.to_account_id,
          title: tx.title ?? '',
          notes: tx.notes ?? '',
        });
      } catch (error) {
        console.error('[transactions:update] Failed to load transaction for edit', error);
        if (!cancelled && mountedRef.current) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Gagal memuat data transaksi.',
          );
          setFormState(null);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
          setAccountsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  const activeType: TxType = formState?.type ?? 'transfer';
  const hookCategoryId = formState?.categoryId ?? null;

  const {
    options: categoryOptions,
    isLoading: categoriesLoading,
    ensureSelectedLoaded,
  } = useCategoriesForEdit(activeType, hookCategoryId, { allowFallback });

  useEffect(() => {
    if (!hookCategoryId || activeType === 'transfer') {
      return;
    }
    void ensureSelectedLoaded(hookCategoryId);
  }, [activeType, ensureSelectedLoaded, hookCategoryId]);

  const categoryId = formState?.categoryId ?? null;

  useEffect(() => {
    if (!formState) {
      return;
    }
    if (activeType === 'transfer') {
      setCategoryHint(null);
      return;
    }
    if (!categoryId) {
      if (!categoriesLoading && categoryOptions.length === 0) {
        setCategoryHint('Kategori tidak ditemukan. Coba ubah tipe atau tambah kategori.');
      } else {
        setCategoryHint(null);
      }
      return;
    }
    const exists = categoryOptions.some((item) => item.id === categoryId);
    if (exists) {
      setCategoryHint(null);
      return;
    }
    if (!categoriesLoading) {
      setCategoryHint('Kategori tidak tersedia untuk tipe ini. Pilih kategori lain.');
      setFormState((prev) => (prev ? { ...prev, categoryId: null } : prev));
    }
  }, [activeType, categoryId, categoryOptions, categoriesLoading, formState]);

  const accountSelectOptions = useMemo(
    () => [{ value: '', label: 'Tidak ada akun' }, ...accounts.map((item) => ({ value: item.id, label: item.name }))],
    [accounts],
  );

  const categorySelectOptions = useMemo(
    () => mapCategoryOptions(categoryOptions),
    [categoryOptions],
  );

  const handleTypeChange = (nextType: TxType) => {
    setAllowFallback(originalTypeRef.current === nextType);
    setFormState((prev) => {
      if (!prev) return prev;
      const nextState: FormState = {
        ...prev,
        type: nextType,
        toAccountId: nextType === 'transfer' ? prev.toAccountId : null,
      };
      if (nextType === 'transfer') {
        nextState.categoryId = null;
      } else if (prev.type === 'transfer') {
        nextState.categoryId = null;
      }
      return nextState;
    });
  };

  const handleFieldChange = (patch: Partial<FormState>) => {
    setFormState((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState) {
      return;
    }
    setFormErrors({});
    setErrorMessage(null);

    const parsedAmount = Number(formState.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormErrors({ amount: 'Jumlah harus lebih dari 0.' });
      return;
    }
    if (formState.type !== 'transfer' && !formState.categoryId) {
      setFormErrors({ categoryId: 'Kategori wajib dipilih.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: formState.date,
        type: formState.type,
        amount: parsedAmount,
        category_id: formState.type === 'transfer' ? null : formState.categoryId,
        account_id: formState.accountId,
        to_account_id: formState.type === 'transfer' ? formState.toAccountId : null,
        title: formState.title.trim() ? formState.title.trim() : null,
        notes: formState.notes.trim() ? formState.notes.trim() : null,
      } satisfies Partial<Tx> & {
        date: string;
        type: TxType;
        amount: number;
        category_id: string | null;
        account_id: string | null;
        to_account_id: string | null;
        title: string | null;
        notes: string | null;
      };
      const updated = await updateTransaction(transactionId, payload);
      onSaved(updated);
    } catch (error) {
      console.error('[transactions:update] Failed to save transaction', error);
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-full animate-pulse rounded-xl bg-surface-alt" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-surface-alt" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-surface-alt" />
      </div>
    );
  }

  if (!formState) {
    return (
      <div className="space-y-3 text-sm text-muted">
        <p>{errorMessage ?? 'Transaksi tidak tersedia.'}</p>
        <button type="button" className="btn" onClick={onCancel}>
          Tutup
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage ? (
        <div className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-text">Edit Transaksi</h3>
        <Segmented
          value={formState.type}
          onChange={(value: string) => handleTypeChange(value as TxType)}
          options={TYPE_OPTIONS}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="date"
          label="Tanggal"
          value={formState.date}
          onChange={(event) => handleFieldChange({ date: event.target.value })}
          required
        />
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          label="Jumlah"
          value={formState.amount}
          onChange={(event) => handleFieldChange({ amount: event.target.value })}
          error={formErrors.amount}
          required
        />
      </div>

      {formState.type !== 'transfer' ? (
        <Select
          label="Kategori"
          value={formState.categoryId ?? ''}
          onChange={(event) => handleFieldChange({ categoryId: event.target.value || null })}
          options={categorySelectOptions}
          placeholder={categoriesLoading ? 'Memuat kategori…' : 'Pilih kategori'}
          helper={categoryHint ?? undefined}
          error={formErrors.categoryId}
          disabled={categoriesLoading}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={formState.type === 'transfer' ? 'Dari Akun' : 'Akun'}
          value={formState.accountId ?? ''}
          onChange={(event) => handleFieldChange({ accountId: event.target.value || null })}
          options={accountSelectOptions}
          placeholder={accountsLoading ? 'Memuat akun…' : 'Pilih akun'}
          disabled={accountsLoading}
        />
        {formState.type === 'transfer' ? (
          <Select
            label="Ke Akun"
            value={formState.toAccountId ?? ''}
            onChange={(event) => handleFieldChange({ toAccountId: event.target.value || null })}
            options={accountSelectOptions}
            placeholder={accountsLoading ? 'Memuat akun…' : 'Pilih akun tujuan'}
            disabled={accountsLoading}
          />
        ) : null}
      </div>

      <Input
        label="Judul"
        value={formState.title}
        onChange={(event) => handleFieldChange({ title: event.target.value })}
        placeholder="Catatan singkat"
      />

      <Textarea
        label="Catatan"
        value={formState.notes}
        onChange={(event) => handleFieldChange({ notes: event.target.value })}
        placeholder="Tambahkan catatan"
        rows={4}
      />

      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
