import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import Modal from './Modal.jsx';
import Input from './ui/Input.jsx';
import Select from './ui/Select.jsx';
import Textarea from './ui/Textarea.jsx';
import { useToast } from '../context/ToastContext';
import useCategoriesForEdit from '../hooks/useCategoriesForEdit';
import type { AccountRecord } from '../lib/api';
import { getTransactionById, updateTransaction, type Tx } from '../services/transactions';

const TYPE_OPTIONS: { value: Tx['type']; label: string }[] = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'transfer', label: 'Transfer' },
];

interface EditTransactionFormProps {
  open: boolean;
  transactionId: string | null;
  accounts: AccountRecord[];
  onClose: () => void;
  onUpdated: (tx: Tx) => void;
}

function formatAmountInput(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '';
  }
  return value.toString();
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function EditTransactionForm({
  open,
  transactionId,
  accounts,
  onClose,
  onUpdated,
}: EditTransactionFormProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryHint, setCategoryHint] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<Tx | null>(null);
  const [type, setType] = useState<Tx['type']>('expense');
  const [date, setDate] = useState<string>(getToday());
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [typeChangedByUser, setTypeChangedByUser] = useState(false);

  const effectiveType: Tx['type'] = open ? type : 'transfer';
  const {
    options: categoryOptions,
    isLoading: categoriesLoading,
    ensureSelectedLoaded,
  } = useCategoriesForEdit(effectiveType, open ? categoryId || undefined : undefined);

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name || 'Tanpa nama',
      })),
    [accounts],
  );

  useEffect(() => {
    if (!open) {
      setTransaction(null);
      setFormError(null);
      setCategoryHint(null);
      setAmount('');
      setCategoryId('');
      setAccountId('');
      setToAccountId('');
      setTitle('');
      setNotes('');
      setType('expense');
      setDate(getToday());
      setTypeChangedByUser(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !transactionId) {
      return;
    }
    setLoading(true);
    setFormError(null);
    setCategoryHint(null);
    getTransactionById(transactionId)
      .then((tx) => {
        if (!tx) {
          setTransaction(null);
          setFormError('Transaksi tidak ditemukan.');
          return;
        }
        setTransaction(tx);
        setType(tx.type);
        setTypeChangedByUser(false);
        setDate(tx.date || getToday());
        setAmount(formatAmountInput(tx.amount));
        setCategoryId(tx.category_id ?? '');
        setAccountId(tx.account_id ?? '');
        setToAccountId(tx.to_account_id ?? '');
        setTitle(tx.title ?? '');
        setNotes(tx.notes ?? '');
        if (tx.category_id) {
          void ensureSelectedLoaded(tx.category_id);
        }
      })
      .catch((error) => {
        console.error('[transactions:list] Failed to fetch transaction detail', error);
        const message =
          error instanceof Error ? error.message : 'Gagal memuat transaksi. Coba lagi.';
        setFormError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ensureSelectedLoaded, open, transactionId]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
    };

    if (type === 'transfer') {
      setCategoryId('');
      setCategoryHint(null);
      return cleanup;
    }
    if (categoriesLoading) {
      return cleanup;
    }
    if (!categoryId) {
      setCategoryHint(null);
      return cleanup;
    }
    const match = categoryOptions.find((category) => category.id === categoryId);
    if (!match) {
      setCategoryHint('Kategori transaksi sebelumnya tidak tersedia. Pilih kategori lain.');
      void ensureSelectedLoaded(categoryId).then((found) => {
        if (!found && !cancelled) {
          setCategoryId('');
        }
      });
      return cleanup;
    }
    if (match.type !== type) {
      if (typeChangedByUser) {
        setCategoryId('');
        setCategoryHint('Kategori direset karena tipe transaksi berubah.');
      } else {
        setCategoryHint('Kategori ini memiliki tipe berbeda. Periksa dan perbarui jika perlu.');
      }
      return cleanup;
    }
    setCategoryHint(null);
    return cleanup;
  }, [
    categoryId,
    categoryOptions,
    categoriesLoading,
    ensureSelectedLoaded,
    open,
    type,
    typeChangedByUser,
  ]);

  const handleTypeChange = useCallback(
    (next: Tx['type']) => {
      setType((prev) => (prev === next ? prev : next));
      if (transaction) {
        setTypeChangedByUser(next !== transaction.type);
      } else {
        setTypeChangedByUser(next !== 'expense');
      }
      if (next === 'transfer') {
        setCategoryId('');
        setCategoryHint(null);
      }
    },
    [transaction],
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!transaction) {
        setFormError('Transaksi tidak ditemukan.');
        return;
      }
      setFormError(null);
      const normalizedAmount = amount.replace(/,/g, '.').trim();
      const amountNumber = Number.parseFloat(normalizedAmount);
      if (!normalizedAmount || !Number.isFinite(amountNumber) || amountNumber <= 0) {
        setFormError('Nominal harus lebih besar dari 0.');
        return;
      }
      if (type !== 'transfer' && !categoryId) {
        setFormError('Kategori wajib dipilih.');
        return;
      }
      if (type === 'transfer') {
        if (!accountId) {
          setFormError('Pilih akun sumber untuk transfer.');
          return;
        }
        if (!toAccountId) {
          setFormError('Pilih akun tujuan untuk transfer.');
          return;
        }
        if (toAccountId === accountId) {
          setFormError('Akun tujuan tidak boleh sama dengan akun sumber.');
          return;
        }
      }
      setSaving(true);
      try {
        const payload = {
          date,
          type,
          amount: amountNumber,
          category_id: type === 'transfer' ? null : categoryId || null,
          title: title.trim() || null,
          notes: notes.trim() || null,
          account_id: accountId || null,
          to_account_id: type === 'transfer' ? toAccountId || null : null,
          merchant_id: transaction.merchant_id,
        } as const;
        const updated = await updateTransaction(transaction.id, payload);
        addToast?.('Transaksi diperbarui.', 'success');
        onUpdated(updated);
        onClose();
      } catch (error) {
        console.error('[transactions:update] Failed to update transaction', error);
        const message =
          error instanceof Error ? error.message : 'Gagal menyimpan transaksi. Coba lagi.';
        setFormError(message);
        addToast?.(message, 'error');
      } finally {
        setSaving(false);
      }
    },
    [
      accountId,
      addToast,
      amount,
      categoryId,
      date,
      notes,
      onClose,
      onUpdated,
      title,
      toAccountId,
      transaction,
      type,
    ],
  );

  const categoryChoices = useMemo(
    () =>
      categoryOptions.map((category) => ({
        value: category.id,
        label: category.type === type ? category.name : `${category.name} (arsip)`,
      })),
    [categoryOptions, type],
  );

  const isTransfer = type === 'transfer';

  return (
    <Modal open={open} title="Edit Transaksi" onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted" aria-hidden="true" />
        </div>
      ) : !transaction ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {formError || 'Transaksi tidak ditemukan atau sudah dihapus.'}
          </p>
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Tutup
            </button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted">Tipe Transaksi</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleTypeChange(option.value)}
                  className={clsx(
                    'rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                    type === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-subtle text-muted hover:border-border-strong hover:text-text',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Tanggal"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />

          <Input
            label="Jumlah"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />

          <Select
            label="Akun"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            options={[{ value: '', label: 'Tanpa akun' }, ...accountOptions]}
            placeholder="Pilih akun"
          />

          {isTransfer ? (
            <Select
              label="Ke Akun"
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
              options={[{ value: '', label: 'Pilih akun tujuan' }, ...accountOptions]}
              placeholder="Pilih akun tujuan"
            />
          ) : (
            <div className="space-y-2">
              <Select
                label="Kategori"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                options={[{ value: '', label: 'Tidak ada kategori' }, ...categoryChoices]}
                disabled={categoriesLoading}
                placeholder="Pilih kategori"
              />
              {categoriesLoading ? (
                <p className="text-xs text-muted">Memuat kategori...</p>
              ) : categoryChoices.length === 0 ? (
                <p className="text-xs text-muted">
                  Kategori tidak ditemukan. Coba ubah tipe atau tambah kategori.
                </p>
              ) : null}
              {categoryHint ? <p className="text-xs text-amber-500">{categoryHint}</p> : null}
            </div>
          )}

          <Input
            label="Judul"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <Textarea
            label="Catatan"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          {formError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Batalkan
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
