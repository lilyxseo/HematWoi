import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import useTxSource, { type TransactionItem } from '../hooks/useTxSource';
import { syncGuestTransactionsToCloud } from '../lib/syncSimple';
import { useToast } from '../context/ToastContext';

const formatter =
  typeof Intl !== 'undefined'
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    : null;

const typeOptions = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
];

type FormState = {
  amount: string;
  date: string;
  type: 'expense' | 'income';
  category_id: string;
  note: string;
};

const initialForm: FormState = {
  amount: '',
  date: '',
  type: 'expense',
  category_id: '',
  note: '',
};

export default function Transactions() {
  const { addToast } = useToast();
  const { mode, uid, hasLocalUnsynced, listTransactions, createTransaction, deleteTransaction, refreshLocalStatus } =
    useTxSource();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const modeLabel = useMemo(() => (mode === 'guest' ? 'Guest (data lokal)' : 'Cloud'), [mode]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTransactions();
      setTransactions(rows);
    } catch (err) {
      console.error('[Transactions] Failed to load list', err);
      setError(err instanceof Error ? err.message : 'Gagal memuat transaksi.');
    } finally {
      setLoading(false);
    }
  }, [listTransactions]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, mode]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        amount: Number(form.amount),
        date: form.date,
        type: form.type,
        category_id: form.category_id ? form.category_id : null,
        note: form.note.trim() ? form.note.trim() : null,
      } as const;
      await createTransaction(payload);
      addToast({ type: 'success', message: 'Transaksi tersimpan.' });
      setForm((prev) => ({ ...prev, amount: '', note: '' }));
      loadTransactions();
      refreshLocalStatus();
    } catch (err) {
      console.error('[Transactions] Failed to create', err);
      const message = err instanceof Error ? err.message : 'Gagal menyimpan transaksi.';
      addToast({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    try {
      await deleteTransaction(id);
      addToast({ type: 'success', message: 'Transaksi dihapus.' });
      loadTransactions();
      refreshLocalStatus();
    } catch (err) {
      console.error('[Transactions] Failed to delete', err);
      const message = err instanceof Error ? err.message : 'Gagal menghapus transaksi.';
      addToast({ type: 'error', message });
    }
  };

  const handleSync = async () => {
    if (!uid) {
      addToast({ type: 'info', message: 'Silakan login dulu untuk sinkronisasi.' });
      return;
    }
    setSyncing(true);
    try {
      const result = await syncGuestTransactionsToCloud(uid);
      refreshLocalStatus();
      if (result.synced > 0 && result.failed === 0) {
        addToast({ type: 'success', message: `${result.synced} transaksi berhasil disinkron.` });
      } else if (result.synced > 0 && result.failed > 0) {
        addToast({
          type: 'warning',
          message: `${result.synced} transaksi berhasil, ${result.failed} gagal. Coba ulangi.`,
        });
      } else if (result.failed > 0) {
        addToast({ type: 'error', message: 'Sinkronisasi gagal. Coba lagi.' });
      } else {
        addToast({ type: 'info', message: 'Tidak ada transaksi lokal yang perlu disinkron.' });
      }
      await loadTransactions();
    } catch (err) {
      console.error('[Transactions] Failed to sync', err);
      const message = err instanceof Error ? err.message : 'Gagal sinkronisasi.';
      addToast({ type: 'error', message });
    } finally {
      setSyncing(false);
    }
  };

  const displayAmount = useCallback((value: number) => {
    if (!formatter) return value.toString();
    return formatter.format(value);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Transaksi</h1>
          <p className="text-sm text-slate-500">Catat pemasukan dan pengeluaranmu dengan cepat.</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              mode === 'guest'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            Mode: {modeLabel}
          </span>
          {mode === 'cloud' && hasLocalUnsynced && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              {syncing ? 'Menyinkronkan...' : 'Sync ke Cloud'}
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Tambah Transaksi</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="amount" className="text-sm font-medium text-slate-700">
              Nominal
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              value={form.amount}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="date" className="text-sm font-medium text-slate-700">
              Tanggal
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              value={form.date}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="type" className="text-sm font-medium text-slate-700">
              Jenis
            </label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="category_id" className="text-sm font-medium text-slate-700">
              Kategori (opsional)
            </label>
            <input
              id="category_id"
              name="category_id"
              type="text"
              value={form.category_id}
              onChange={handleInputChange}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Contoh: Makan"
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label htmlFor="note" className="text-sm font-medium text-slate-700">
              Catatan (opsional)
            </label>
            <textarea
              id="note"
              name="note"
              value={form.note}
              onChange={handleInputChange}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Tambahkan catatan"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
          >
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Daftar Transaksi</h2>
          {loading && <span className="text-sm text-slate-500">Memuat...</span>}
        </header>
        {error && <p className="px-4 py-3 text-sm text-rose-600">{error}</p>}
        {!loading && transactions.length === 0 && !error && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Belum ada transaksi. Tambahkan transaksi pertama kamu.
          </p>
        )}
        {transactions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Jenis</th>
                  <th className="px-4 py-3 text-left">Nominal</th>
                  <th className="px-4 py-3 text-left">Kategori</th>
                  <th className="px-4 py-3 text-left">Catatan</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactions.map((tx) => (
                  <tr key={`${tx.origin}-${tx.id}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">{tx.date}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">
                      {tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {displayAmount(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{tx.category_id || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{tx.note || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(tx.id)}
                        className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
