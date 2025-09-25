import { useEffect, useMemo, useState } from 'react';
import { Calendar, PiggyBank, PieChart, Plus, Target, Trash2, Wallet, PencilLine } from 'lucide-react';
import Page from '../../layout/Page';
import Section from '../../layout/Section.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useBudgets from '../../hooks/useBudgets';
import {
  buildSummary,
  deleteBudget,
  listCategoriesExpense,
  type BudgetCategory,
  type BudgetWithSpent,
  type BudgetInput,
  upsertBudget,
} from '../../repo/budgetApi';
import Modal from '../../components/Modal.jsx';
import { formatCurrency } from '../../lib/format.js';

interface PeriodOption {
  label: string;
  value: 'current' | 'previous' | 'custom';
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: 'Bulan ini', value: 'current' },
  { label: 'Bulan lalu', value: 'previous' },
  { label: 'Custom', value: 'custom' },
];

function getCurrentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function getPreviousPeriod(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function resolvePeriod(preset: PeriodOption['value'], custom: string): string {
  switch (preset) {
    case 'current':
      return getCurrentPeriod();
    case 'previous':
      return getPreviousPeriod();
    case 'custom':
    default:
      return custom || getCurrentPeriod();
  }
}

interface BudgetFormModalProps {
  open: boolean;
  onClose: () => void;
  categories: BudgetCategory[];
  period: string;
  initialBudget?: BudgetWithSpent | null;
  onSubmit: (payload: BudgetInput) => Promise<void>;
}

function BudgetFormModal({ open, onClose, categories, period, initialBudget, onSubmit }: BudgetFormModalProps) {
  const [formPeriod, setFormPeriod] = useState(period);
  const [categoryId, setCategoryId] = useState(initialBudget?.category_id ?? '');
  const [amount, setAmount] = useState(() =>
    initialBudget ? String(initialBudget.amount_planned) : ''
  );
  const [carryover, setCarryover] = useState(initialBudget?.carryover_enabled ?? false);
  const [notes, setNotes] = useState(initialBudget?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormPeriod(initialBudget ? initialBudget.period_month.slice(0, 7) : period);
    setCategoryId(initialBudget?.category_id ?? '');
    setAmount(initialBudget ? String(initialBudget.amount_planned) : '');
    setCarryover(initialBudget?.carryover_enabled ?? false);
    setNotes(initialBudget?.notes ?? '');
    setFormError(null);
  }, [open, initialBudget, period]);

  const title = initialBudget ? 'Edit Anggaran' : 'Tambah Anggaran';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!formPeriod) {
      setFormError('Periode wajib dipilih.');
      return;
    }
    if (!categoryId) {
      setFormError('Kategori wajib dipilih.');
      return;
    }
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setFormError('Nominal anggaran harus lebih besar dari 0.');
      return;
    }

    const payload: BudgetInput = {
      period: formPeriod,
      category_id: categoryId,
      amount_planned: amountNumber,
      carryover_enabled: carryover,
      notes: notes.trim() ? notes.trim() : undefined,
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan anggaran';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Periode
            <input
              type="month"
              value={formPeriod}
              onChange={(event) => setFormPeriod(event.target.value)}
              className="h-11 rounded-2xl border border-white/40 bg-white/80 px-4 text-sm text-slate-900 shadow-sm ring-2 ring-transparent transition focus:border-indigo-500 focus:ring-indigo-400 dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-100"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Kategori
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-11 rounded-2xl border border-white/40 bg-white/80 px-4 text-sm text-slate-900 shadow-sm ring-2 ring-transparent transition focus:border-indigo-500 focus:ring-indigo-400 dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-100"
              required
            >
              <option value="">Pilih kategori</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Nominal anggaran
            <input
              type="number"
              min="0"
              step="1000"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-11 rounded-2xl border border-white/40 bg-white/80 px-4 text-sm text-slate-900 shadow-sm ring-2 ring-transparent transition focus:border-indigo-500 focus:ring-indigo-400 dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-100"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            Catatan
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opsional"
              className="h-11 rounded-2xl border border-white/40 bg-white/80 px-4 text-sm text-slate-900 shadow-sm ring-2 ring-transparent transition focus:border-indigo-500 focus:ring-indigo-400 dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-100"
            />
          </label>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm ring-2 ring-transparent transition dark:border-white/10 dark:bg-zinc-900/50 dark:text-slate-200">
          Aktifkan carryover
          <button
            type="button"
            role="switch"
            aria-checked={carryover}
            onClick={() => setCarryover((value) => !value)}
            className={`relative h-8 w-14 rounded-full border border-transparent bg-gradient-to-r p-1 transition ${
              carryover
                ? 'from-emerald-500 to-emerald-400 text-white shadow-inner'
                : 'from-slate-200 to-slate-200 text-slate-600 dark:from-zinc-700 dark:to-zinc-700'
            }`}
          >
            <span
              className={`block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                carryover ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
        {formError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
            {formError}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="h-11 rounded-2xl border border-transparent bg-slate-200/80 px-5 text-sm font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-zinc-700 dark:text-slate-100 dark:hover:bg-zinc-600"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white shadow transition hover:from-indigo-600 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? 'Menyimpan…' : 'Simpan anggaran'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BudgetSummaryCards({
  planned,
  spent,
  remaining,
}: {
  planned: number;
  spent: number;
  remaining: number;
}) {
  const percentageValue = planned > 0 ? (spent / planned) * 100 : 0;
  const percentageRatio = Math.max(0, Math.min(percentageValue, 100));
  const items = [
    {
      label: 'Total Anggaran',
      value: formatCurrency(planned, 'IDR'),
      icon: Wallet,
    },
    {
      label: 'Realisasi',
      value: formatCurrency(spent, 'IDR'),
      icon: PiggyBank,
    },
    {
      label: 'Sisa',
      value: formatCurrency(remaining, 'IDR'),
      icon: Target,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-white/40 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:from-zinc-900/60 dark:to-zinc-900/30"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
              <item.icon size={22} strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{item.value}</p>
            </div>
          </div>
        </div>
      ))}
      <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-white/40 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:from-zinc-900/60 dark:to-zinc-900/30">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
            <PieChart size={22} strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Persentase</p>
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{Math.round(percentageValue)}%</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Realisasi</span>
            <span>{formatCurrency(spent, 'IDR')}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Target</span>
            <span>{formatCurrency(planned, 'IDR')}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
              style={{ width: `${percentageRatio}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetsTable({
  rows,
  onEdit,
  onDelete,
  onToggleCarryover,
  busyId,
}: {
  rows: BudgetWithSpent[];
  onEdit: (budget: BudgetWithSpent) => void;
  onDelete: (budget: BudgetWithSpent) => void;
  onToggleCarryover: (budget: BudgetWithSpent) => void;
  busyId: string | null;
}) {
  const formattedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        remaining: row.amount_planned - row.spent,
      })),
    [rows]
  );

  if (!formattedRows.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300/60 bg-white/70 px-6 py-12 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <Calendar className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-200">Belum ada anggaran</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mulai dengan menambahkan kategori anggaran untuk periode ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/40">
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white/90 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur dark:bg-zinc-900/80 dark:text-slate-400">
            <tr>
              <th className="px-6 py-4">Kategori</th>
              <th className="px-6 py-4 text-right">Planned</th>
              <th className="px-6 py-4 text-right">Spent</th>
              <th className="px-6 py-4 text-right">Remaining</th>
              <th className="px-6 py-4 text-center">Carryover</th>
              <th className="px-6 py-4">Catatan</th>
              <th className="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {formattedRows.map((row, index) => (
              <tr
                key={row.id}
                className={`${
                  index % 2 === 0
                    ? 'bg-white/70 dark:bg-zinc-900/40'
                    : 'bg-white/40 dark:bg-zinc-900/30'
                } transition hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10`}
              >
                <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-100">
                  {row.category?.name ?? 'Kategori tidak tersedia'}
                </td>
                <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">
                  {formatCurrency(row.amount_planned, 'IDR')}
                </td>
                <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-300">
                  {formatCurrency(row.spent, 'IDR')}
                </td>
                <td
                  className={`px-6 py-4 text-right font-semibold ${
                    row.remaining < 0
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {formatCurrency(row.remaining, 'IDR')}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.carryover_enabled}
                      onClick={() => onToggleCarryover(row)}
                      disabled={busyId === row.id || !row.category_id}
                      className={`relative h-8 w-14 rounded-full border border-transparent p-1 transition ${
                        row.carryover_enabled
                          ? 'from-emerald-500 to-emerald-400 text-white shadow-inner'
                          : 'from-slate-200 to-slate-200 text-slate-600 dark:from-zinc-700 dark:to-zinc-700'
                      } bg-gradient-to-r disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                          row.carryover_enabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-300">
                  {row.notes ?? '—'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-slate-200/70 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-zinc-700 dark:text-slate-100 dark:hover:bg-zinc-600"
                    >
                      <PencilLine size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row)}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-full bg-rose-500/10 px-3 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                    >
                      <Trash2 size={16} />
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  const { addToast } = useToast();
  const [preset, setPreset] = useState<PeriodOption['value']>('current');
  const [customPeriod, setCustomPeriod] = useState<string>(getCurrentPeriod());
  const period = resolvePeriod(preset, customPeriod);
  const { rows, loading, error, refresh } = useBudgets(period);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ open: boolean; editing: BudgetWithSpent | null }>(
    { open: false, editing: null }
  );

  useEffect(() => {
    let mounted = true;
    setCategoriesLoading(true);
    listCategoriesExpense()
      .then((data) => {
        if (mounted) {
          setCategories(data);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Gagal memuat kategori';
        addToast(message, 'error');
      })
      .finally(() => {
        if (mounted) setCategoriesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [addToast]);

  const handleToggleCarryover = async (budget: BudgetWithSpent) => {
    if (!budget.category_id) {
      addToast('Kategori tidak ditemukan untuk anggaran ini.', 'error');
      return;
    }
    setBusyId(budget.id);
    try {
      await upsertBudget({
        period: budget.period_month.slice(0, 7),
        category_id: budget.category_id,
        amount_planned: budget.amount_planned,
        carryover_enabled: !budget.carryover_enabled,
        notes: budget.notes ?? undefined,
      });
      addToast('Pengaturan carryover diperbarui.', 'success');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui carryover';
      addToast(message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (budget: BudgetWithSpent) => {
    const confirmed = window.confirm(`Hapus anggaran ${budget.category?.name ?? ''}?`);
    if (!confirmed) return;
    try {
      await deleteBudget(budget.id);
      addToast('Anggaran dihapus.', 'success');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus anggaran';
      addToast(message, 'error');
    }
  };

  const handleFormSubmit = async (payload: BudgetInput) => {
    try {
      await upsertBudget(payload);
      addToast('Anggaran tersimpan.', 'success');
      setModalState({ open: false, editing: null });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan anggaran';
      addToast(message, 'error');
      throw err;
    }
  };

  const handleOpenCreate = () => {
    setModalState({ open: true, editing: null });
  };

  const handleEdit = (budget: BudgetWithSpent) => {
    setModalState({ open: true, editing: budget });
  };

  const closeModal = () => {
    setModalState({ open: false, editing: null });
  };

  const isLoadingTable = loading;
  const expenseCategorySet = useMemo(() => new Set(categories.map((item) => item.id)), [categories]);
  const tableRows = useMemo(() => {
    if (!categories.length) return rows;
    return rows.filter((row) => !row.category_id || expenseCategorySet.has(row.category_id));
  }, [categories.length, expenseCategorySet, rows]);
  const summaryForDisplay = useMemo(() => buildSummary(tableRows), [tableRows]);

  return (
    <Page>
      <Section first>
        <div className="flex flex-col gap-6 rounded-2xl border border-white/40 bg-gradient-to-b from-white/90 to-white/60 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:from-zinc-900/70 dark:to-zinc-900/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Anggaran</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Kelola anggaran pengeluaran per kategori dan pantau progresnya.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white shadow transition hover:from-indigo-600 hover:to-violet-600"
            >
              <Plus size={18} />
              Tambah anggaran
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/60 p-1 ring-2 ring-white/60 backdrop-blur dark:bg-zinc-900/60 dark:ring-white/10">
              {PERIOD_OPTIONS.map((option) => {
                const active = preset === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreset(option.value)}
                    className={`flex h-11 items-center rounded-2xl px-4 text-sm font-semibold transition ${
                      active
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow'
                        : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-zinc-800/80'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Calendar size={18} />
              {preset === 'custom' ? (
                <input
                  type="month"
                  value={customPeriod}
                  onChange={(event) => setCustomPeriod(event.target.value)}
                  className="h-11 rounded-2xl border border-white/40 bg-white/80 px-4 text-sm shadow-sm ring-2 ring-transparent transition focus:border-indigo-500 focus:ring-indigo-400 dark:border-white/10 dark:bg-zinc-900/60 dark:text-slate-100"
                />
              ) : (
                <span className="font-semibold">{period}</span>
              )}
            </div>
          </div>
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}
          {isLoadingTable ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-32 rounded-2xl border border-white/40 bg-white/60 shadow-sm backdrop-blur animate-pulse dark:border-white/10 dark:bg-zinc-900/40"
                />
              ))}
            </div>
          ) : (
            <BudgetSummaryCards
              planned={summaryForDisplay.planned}
              spent={summaryForDisplay.spent}
              remaining={summaryForDisplay.remaining}
            />
          )}
        </div>
      </Section>

      <Section>
        {isLoadingTable ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-16 rounded-2xl border border-white/40 bg-white/60 shadow-sm backdrop-blur animate-pulse dark:border-white/10 dark:bg-zinc-900/40"
              />
            ))}
          </div>
        ) : (
          <BudgetsTable
            rows={tableRows}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleCarryover={handleToggleCarryover}
            busyId={busyId}
          />
        )}
      </Section>

      <BudgetFormModal
        open={modalState.open}
        onClose={closeModal}
        categories={categories}
        period={period}
        initialBudget={modalState.editing}
        onSubmit={handleFormSubmit}
      />

      {categoriesLoading ? (
        <div className="sr-only" aria-live="polite">
          Memuat kategori…
        </div>
      ) : null}
    </Page>
  );
}
