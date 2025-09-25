import { useCallback, useEffect, useMemo, useState, type ComponentType, type FormEvent } from 'react';
import clsx from 'clsx';
import {
  Calendar as CalendarIcon,
  Loader2,
  Pencil,
  PiggyBank,
  PieChart,
  Plus,
  Trash2,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import Page from '../layout/Page.jsx';
import PageHeader from '../layout/PageHeader.jsx';
import Section from '../layout/Section.jsx';
import useSupabaseUser from '../hooks/useSupabaseUser';
import useBudgets from '../hooks/useBudgets';
import { useToast } from '../context/ToastContext.jsx';
import { deleteBudget, upsertBudget } from '../lib/budgetApi.ts';
import type { BudgetRow } from '../hooks/useBudgets';
import type { BudgetCategory } from '../lib/budgetApi.ts';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface BudgetFormValues {
  id?: string;
  period: string; // YYYY-MM
  categoryId: string;
  amountPlanned: number;
  carryoverEnabled: boolean;
  notes: string;
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(value));
}

function formatMonth(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function PeriodSelector({
  mode,
  onModeChange,
  customMonth,
  onCustomChange,
}: {
  mode: 'current' | 'previous' | 'custom';
  onModeChange: (mode: 'current' | 'previous' | 'custom') => void;
  customMonth: string;
  onCustomChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-2xl border border-white/30 bg-white/60 p-1 backdrop-blur dark:border-white/10 dark:bg-zinc-900/50">
          {[
            { label: 'Bulan ini', value: 'current' as const },
            { label: 'Bulan lalu', value: 'previous' as const },
            { label: 'Custom', value: 'custom' as const },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onModeChange(item.value)}
              aria-pressed={mode === item.value}
              className={clsx(
                'h-11 min-w-[120px] rounded-2xl px-5 text-sm font-semibold transition',
                mode === item.value
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-zinc-800/60'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'custom' && (
        <label className="flex h-11 items-center gap-3 rounded-2xl border border-white/40 bg-white/70 px-4 text-sm font-medium text-slate-700 shadow-sm ring-2 ring-transparent backdrop-blur dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-200">
          <CalendarIcon className="h-4 w-4" aria-hidden="true" />
          <span className="whitespace-nowrap">Pilih periode</span>
          <input
            type="month"
            value={customMonth}
            onChange={(event) => onCustomChange(event.target.value)}
            className="h-11 min-w-[140px] rounded-2xl border-0 bg-transparent text-sm font-medium text-slate-900 outline-none focus:ring-0 dark:text-white"
          />
        </label>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  accent,
  footer,
}: {
  title: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  footer?: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/30 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:from-zinc-900/60 dark:to-zinc-900/30">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
        </div>
        <span
          className={clsx(
            'flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg shadow-emerald-500/20',
            accent
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {footer && <p className="text-xs text-slate-500 dark:text-slate-400">{footer}</p>}
    </div>
  );
}

function SummarySection({
  totalPlanned,
  totalSpent,
  remaining,
  percentage,
}: {
  totalPlanned: number;
  totalSpent: number;
  remaining: number;
  percentage: number;
}) {
  const progress = Number.isFinite(percentage) ? Math.min(100, Math.max(0, percentage)) : 0;
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Progress Bulan Ini</p>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{progress.toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Anggaran" value={formatCurrency(totalPlanned)} accent="bg-emerald-500" icon={Wallet} />
        <SummaryCard title="Realisasi" value={formatCurrency(totalSpent)} accent="bg-sky-500" icon={TrendingDown} />
        <SummaryCard title="Sisa" value={formatCurrency(remaining)} accent="bg-indigo-500" icon={PiggyBank} />
        <SummaryCard
          title="Persentase"
          value={`${progress.toFixed(0)}%`}
          accent="bg-rose-500"
          icon={PieChart}
          footer="Persentase realisasi dibandingkan total anggaran."
        />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 4 }).map((_, index) => (
        <tr key={index} className="odd:bg-white/70 even:bg-white/60 dark:odd:bg-zinc-900/40 dark:even:bg-zinc-900/30">
          <td className="px-5 py-4" colSpan={7}>
            <div className="h-6 w-full animate-pulse rounded-full bg-slate-200/70 dark:bg-zinc-800/80" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState() {
  return (
    <tbody>
      <tr>
        <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Belum ada anggaran untuk periode ini. Tambahkan anggaran untuk mulai melacak pengeluaran Anda.
        </td>
      </tr>
    </tbody>
  );
}

function BudgetTable({
  rows,
  loading,
  onEdit,
  onDelete,
  onToggleCarryover,
  carryoverBusyId,
  deletingId,
}: {
  rows: BudgetRow[];
  loading: boolean;
  onEdit: (row: BudgetRow) => void;
  onDelete: (row: BudgetRow) => void;
  onToggleCarryover: (row: BudgetRow) => void;
  carryoverBusyId: string | null;
  deletingId: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/30 bg-gradient-to-b from-white/85 to-white/60 shadow-sm backdrop-blur dark:border-white/10 dark:from-zinc-900/70 dark:to-zinc-900/40">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm text-slate-700 dark:text-slate-200">
          <thead className="sticky top-0 z-20 bg-white/90 text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-zinc-950/80 dark:text-slate-400">
            <tr>
              <th className="px-5 py-4 text-left font-semibold">Kategori</th>
              <th className="px-5 py-4 text-right font-semibold">Planned</th>
              <th className="px-5 py-4 text-right font-semibold">Spent</th>
              <th className="px-5 py-4 text-right font-semibold">Remaining</th>
              <th className="px-5 py-4 text-center font-semibold">Carryover</th>
              <th className="px-5 py-4 text-left font-semibold">Catatan</th>
              <th className="px-5 py-4 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          {loading && !rows.length ? (
            <TableSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState />
          ) : (
            <tbody>
              {rows.map((row, index) => {
                const isCarryBusy = carryoverBusyId === row.id;
                const isDeleting = deletingId === row.id;
                const remainingClass = row.remaining < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-900 dark:text-white';
                return (
                  <tr
                    key={row.id}
                    className={clsx(
                      'transition hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20',
                      index % 2 === 0
                        ? 'bg-white/80 dark:bg-zinc-900/40'
                        : 'bg-white/60 dark:bg-zinc-900/30'
                    )}
                  >
                    <td className="px-5 py-4 text-sm font-medium text-slate-900 dark:text-white">{row.categoryName}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-600 dark:text-slate-300">
                      {formatCurrency(row.amountPlanned)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-600 dark:text-slate-300">
                      {formatCurrency(row.spent)}
                    </td>
                    <td className={clsx('px-5 py-4 text-right font-semibold', remainingClass)}>
                      {formatCurrency(row.remaining)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => onToggleCarryover(row)}
                        disabled={isCarryBusy || isDeleting}
                        className={clsx(
                          'relative inline-flex h-8 w-14 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-emerald-400',
                          row.carryoverEnabled
                            ? 'bg-emerald-500'
                            : 'bg-slate-300 dark:bg-zinc-700',
                          (isCarryBusy || isDeleting) && 'opacity-60'
                        )}
                        aria-pressed={row.carryoverEnabled}
                        aria-label={`Carryover ${row.categoryName}`}
                      >
                        <span
                          className={clsx(
                            'inline-block h-6 w-6 transform rounded-full bg-white shadow transition',
                            row.carryoverEnabled ? 'translate-x-7' : 'translate-x-1'
                          )}
                        />
                        {isCarryBusy && (
                          <Loader2 className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" />
                        )}
                      </button>
                    </td>
                    <td className="max-w-xs px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {row.notes ? row.notes : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="h-9 w-9 rounded-2xl border border-transparent bg-white/70 text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-600 dark:bg-zinc-900/60 dark:text-slate-300 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400"
                          title="Edit anggaran"
                        >
                          <Pencil className="mx-auto h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          disabled={isDeleting}
                          className="h-9 w-9 rounded-2xl border border-transparent bg-white/70 text-rose-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 dark:bg-zinc-900/60 dark:text-rose-400 dark:hover:border-rose-500/40"
                          title="Hapus anggaran"
                        >
                          {isDeleting ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="mx-auto h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

function groupCategories(categories: BudgetCategory[]): { label: string; options: BudgetCategory[] }[] {
  const groups = new Map<string, BudgetCategory[]>();
  categories.forEach((category) => {
    const key = category.group_name ?? 'Lainnya';
    const bucket = groups.get(key) ?? [];
    bucket.push(category);
    groups.set(key, bucket);
  });
  return Array.from(groups.entries()).map(([label, options]) => ({
    label,
    options: options.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })),
  }));
}

function BudgetFormDialog({
  open,
  onClose,
  onSubmit,
  categories,
  busy,
  error,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: BudgetFormValues) => Promise<void>;
  categories: BudgetCategory[];
  busy: boolean;
  error: string | null;
  initialValues: BudgetFormValues;
}) {
  const [period, setPeriod] = useState(initialValues.period);
  const [categoryId, setCategoryId] = useState(initialValues.categoryId);
  const [amount, setAmount] = useState(String(initialValues.amountPlanned ?? 0));
  const [carryover, setCarryover] = useState(initialValues.carryoverEnabled);
  const [notes, setNotes] = useState(initialValues.notes ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const groupedOptions = useMemo(() => groupCategories(categories), [categories]);

  const resetState = useCallback(() => {
    setPeriod(initialValues.period);
    setCategoryId(initialValues.categoryId);
    setAmount(String(initialValues.amountPlanned ?? 0));
    setCarryover(initialValues.carryoverEnabled);
    setNotes(initialValues.notes ?? '');
    setLocalError(null);
  }, [initialValues]);

  const handleClose = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const numericAmount = Number(amount);
      if (!period) {
        setLocalError('Periode wajib diisi.');
        return;
      }
      if (!categoryId) {
        setLocalError('Pilih kategori pengeluaran.');
        return;
      }
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setLocalError('Nominal anggaran harus lebih dari 0.');
        return;
      }
      setLocalError(null);
      await onSubmit({
        id: initialValues.id,
        period,
        categoryId,
        amountPlanned: numericAmount,
        carryoverEnabled: carryover,
        notes: notes.trim(),
      });
    },
    [amount, carryover, categoryId, initialValues.id, notes, onSubmit, period]
  );

  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open, resetState]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-white/30 bg-gradient-to-b from-white/90 to-white/70 p-6 shadow-2xl backdrop-blur dark:border-white/10 dark:from-zinc-950/80 dark:to-zinc-900/70">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {initialValues.id ? 'Edit Anggaran' : 'Tambah Anggaran'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tetapkan anggaran untuk kategori pengeluaran pilihan Anda.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="h-10 w-10 rounded-2xl border border-transparent bg-white/80 text-slate-500 transition hover:text-slate-900 dark:bg-zinc-900/60 dark:text-slate-300"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>Periode</span>
              <input
                type="month"
                className="h-11 w-full rounded-2xl border border-white/30 bg-white/80 px-4 text-sm text-slate-900 shadow-sm ring-2 ring-transparent transition focus:ring-emerald-400/60 focus:outline-none dark:border-white/10 dark:bg-zinc-900/60 dark:text-white"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <span>Kategori</span>
              <select
                className="h-11 w-full rounded-2xl border border-white/30 bg-white/80 px-4 text-sm text-slate-900 shadow-sm ring-2 ring-transparent transition focus:ring-emerald-400/60 focus:outline-none dark:border-white/10 dark:bg-zinc-900/60 dark:text-white"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Pilih kategori</option>
                {groupedOptions.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Nominal Anggaran</span>
            <input
              type="number"
              min="0"
              step="1000"
              className="h-11 w-full rounded-2xl border border-white/30 bg-white/80 px-4 text-sm text-slate-900 shadow-sm ring-2 ring-transparent transition focus:ring-emerald-400/60 focus:outline-none dark:border-white/10 dark:bg-zinc-900/60 dark:text-white"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Contoh: 2000000"
            />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/30 bg-white/70 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm ring-2 ring-transparent transition focus-within:ring-emerald-400/60 dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-300">
            <div>
              <p className="font-semibold text-slate-700 dark:text-white">Carryover otomatis</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sisa anggaran akan dibawa ke bulan berikutnya jika diaktifkan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCarryover((prev) => !prev)}
              className={clsx(
                'relative inline-flex h-8 w-14 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-emerald-400',
                carryover ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'
              )}
              aria-pressed={carryover}
              aria-label="Toggle carryover"
            >
              <span
                className={clsx(
                  'inline-block h-6 w-6 transform rounded-full bg-white shadow transition',
                  carryover ? 'translate-x-7' : 'translate-x-1'
                )}
              />
            </button>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <span>Catatan (opsional)</span>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-white/30 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-sm ring-2 ring-transparent transition focus:ring-emerald-400/60 focus:outline-none dark:border-white/10 dark:bg-zinc-900/60 dark:text-white"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Tambahkan catatan pendukung untuk anggaran ini"
            />
          </label>
          {(localError || error) && (
            <div className="rounded-2xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
              {localError || error}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="h-11 min-w-[120px] rounded-2xl border border-white/40 bg-white/70 px-5 text-sm font-semibold text-slate-600 transition hover:bg-white/90 dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-300"
              disabled={busy}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-11 min-w-[140px] rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-500/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Menyimpan...
                </span>
              ) : (
                'Simpan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { addToast } = useToast();
  const { user } = useSupabaseUser();
  const today = useMemo(() => new Date(), []);
  const currentMonth = useMemo(() => formatMonth(today), [today]);
  const previousMonth = useMemo(() => {
    const previous = new Date(today);
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    return formatMonth(previous);
  }, [today]);

  const [mode, setMode] = useState<'current' | 'previous' | 'custom'>('current');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [customMonth, setCustomMonth] = useState(currentMonth);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<BudgetRow | null>(null);
  const [carryBusyId, setCarryBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { rows, summary, loading, error, refresh, categories } = useBudgets(selectedMonth, user?.id ?? null);

  const handleModeChange = useCallback(
    (nextMode: 'current' | 'previous' | 'custom') => {
      setMode(nextMode);
      if (nextMode === 'current') {
        setSelectedMonth(currentMonth);
      } else if (nextMode === 'previous') {
        setSelectedMonth(previousMonth);
      } else {
        setSelectedMonth(customMonth);
      }
    },
    [currentMonth, previousMonth, customMonth]
  );

  const handleCustomChange = useCallback(
    (value: string) => {
      setCustomMonth(value);
      if (mode === 'custom') {
        setSelectedMonth(value);
      }
    },
    [mode]
  );

  const handleAddClick = useCallback(() => {
    setEditingRow(null);
    setModalError(null);
    setModalOpen(true);
  }, []);

  const handleEditClick = useCallback((row: BudgetRow) => {
    setEditingRow(row);
    setModalError(null);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    if (modalBusy) return;
    setModalError(null);
    setModalOpen(false);
  }, [modalBusy, setModalError]);

  const handleDelete = useCallback(
    async (row: BudgetRow) => {
      if (!window.confirm(`Hapus anggaran "${row.categoryName}"?`)) {
        return;
      }
      setDeletingId(row.id);
      try {
        await deleteBudget(row.id);
        addToast('Anggaran berhasil dihapus.', 'success');
        await refresh();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : 'Gagal menghapus anggaran. Silakan coba lagi.';
        addToast(message, 'error');
      } finally {
        setDeletingId(null);
      }
    },
    [addToast, refresh]
  );

  const handleCarryToggle = useCallback(
    async (row: BudgetRow) => {
      if (!user?.id || !row.categoryId) return;
      setCarryBusyId(row.id);
      try {
        await upsertBudget({
          userId: user.id,
          id: row.id,
          period: selectedMonth,
          categoryId: row.categoryId,
          amountPlanned: row.amountPlanned,
          carryoverEnabled: !row.carryoverEnabled,
          notes: row.notes ?? null,
        });
        addToast('Status carryover diperbarui.', 'success');
        await refresh();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : 'Gagal memperbarui carryover. Silakan coba lagi.';
        addToast(message, 'error');
      } finally {
        setCarryBusyId(null);
      }
    },
    [addToast, refresh, selectedMonth, user]
  );

  const handleFormSubmit = useCallback(
    async (values: BudgetFormValues) => {
      if (!user?.id) {
        setModalError('Anda harus login untuk menyimpan anggaran.');
        return;
      }
      setModalBusy(true);
      setModalError(null);
      try {
        await upsertBudget({
          userId: user.id,
          id: values.id,
          period: values.period,
          categoryId: values.categoryId,
          amountPlanned: values.amountPlanned,
          carryoverEnabled: values.carryoverEnabled,
          notes: values.notes.trim() ? values.notes.trim() : null,
        });
        addToast('Anggaran berhasil disimpan.', 'success');
        setModalOpen(false);
        await refresh();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : 'Gagal menyimpan anggaran. Silakan coba lagi.';
        setModalError(message);
      } finally {
        setModalBusy(false);
      }
    },
    [addToast, refresh, user]
  );

  const modalInitialValues = useMemo<BudgetFormValues>(() => {
    if (editingRow) {
      return {
        id: editingRow.id,
        period: editingRow.periodMonth.slice(0, 7),
        categoryId: editingRow.categoryId ?? '',
        amountPlanned: editingRow.amountPlanned,
        carryoverEnabled: editingRow.carryoverEnabled,
        notes: editingRow.notes ?? '',
      };
    }
    return {
      period: selectedMonth,
      categoryId: '',
      amountPlanned: 0,
      carryoverEnabled: false,
      notes: '',
    };
  }, [editingRow, selectedMonth]);

  return (
    <Page>
      <PageHeader
        title="Anggaran"
        description="Kelola anggaran bulanan Anda dan pantau realisasi pengeluaran dengan mudah."
      >
        <button
          type="button"
          onClick={handleAddClick}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-500/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!user?.id || categories.length === 0}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Anggaran
        </button>
      </PageHeader>

      <Section first>
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/30 bg-gradient-to-b from-white/90 to-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:from-zinc-950/80 dark:to-zinc-900/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Periode Anggaran</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih rentang waktu untuk melihat anggaran dan realisasi pengeluaran.
                </p>
              </div>
              <CalendarIcon className="hidden h-10 w-10 text-emerald-500/70 md:block" aria-hidden="true" />
            </div>
            <div className="mt-5">
              <PeriodSelector
                mode={mode}
                onModeChange={handleModeChange}
                customMonth={customMonth}
                onCustomChange={handleCustomChange}
              />
            </div>
          </div>

          <SummarySection
            totalPlanned={summary.totalPlanned}
            totalSpent={summary.totalSpent}
            remaining={summary.remaining}
            percentage={summary.percentage}
          />
        </div>
      </Section>

      <Section>
        {error && (
          <div className="mb-4 rounded-3xl border border-rose-200/60 bg-rose-50/80 px-5 py-4 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}
        <BudgetTable
          rows={rows}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDelete}
          onToggleCarryover={handleCarryToggle}
          carryoverBusyId={carryBusyId}
          deletingId={deletingId}
        />
      </Section>

      <BudgetFormDialog
        open={modalOpen}
        onClose={handleModalClose}
        onSubmit={handleFormSubmit}
        categories={categories}
        busy={modalBusy}
        error={modalError}
        initialValues={modalInitialValues}
      />
    </Page>
  );
}
