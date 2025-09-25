import { useEffect, useMemo, useState } from 'react';
import { Calendar, Loader2, Plus, RefreshCw } from 'lucide-react';
import Page from '../../layout/Page';
import Section from '../../layout/Section';
import { useToast } from '../../context/ToastContext';
import BudgetSummaryCards from '../../components/budgets/BudgetSummaryCards';
import BudgetTable from '../../components/budgets/BudgetTable';
import BudgetFormDialog, { type BudgetFormValues } from '../../components/budgets/BudgetFormDialog';
import { useBudgets, type BudgetRowView } from '../../hooks/useBudgets';
import {
  deleteBudget,
  listCategoriesExpense,
  upsertBudget,
  type ExpenseCategory,
} from '../../lib/budgetApi';

function formatPeriodFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function getPreviousMonth(period: string): string {
  const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return period;
  const prev = new Date(year, month - 1, 1);
  prev.setMonth(prev.getMonth() - 1);
  return formatPeriodFromDate(prev);
}

type PeriodMode = 'current' | 'previous' | 'custom';

export default function BudgetsPage() {
  const { addToast } = useToast();
  const now = useMemo(() => new Date(), []);
  const currentPeriod = useMemo(() => formatPeriodFromDate(now), [now]);
  const lastPeriod = useMemo(() => getPreviousMonth(currentPeriod), [currentPeriod]);

  const [periodMode, setPeriodMode] = useState<PeriodMode>('current');
  const [customPeriod, setCustomPeriod] = useState(currentPeriod);
  const selectedPeriod = useMemo(() => {
    if (periodMode === 'current') return currentPeriod;
    if (periodMode === 'previous') return lastPeriod;
    return customPeriod || currentPeriod;
  }, [periodMode, currentPeriod, lastPeriod, customPeriod]);

  const { rows, summary, loading, error, refresh } = useBudgets(selectedPeriod);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetRowView | null>(null);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    (async () => {
      try {
        const items = await listCategoriesExpense();
        if (!active) return;
        setCategories(items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memuat kategori';
        addToast(message, 'error');
      } finally {
        if (active) setCategoriesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [addToast]);

  useEffect(() => {
    if (periodMode !== 'custom') {
      setCustomPeriod((prev) => (prev ? prev : currentPeriod));
    }
  }, [periodMode, currentPeriod]);

  const handleOpenCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (row: BudgetRowView) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleDelete = async (row: BudgetRowView) => {
    const confirmed = window.confirm(`Hapus anggaran "${row.categoryName}" untuk periode ini?`);
    if (!confirmed) return;
    try {
      setProcessingId(row.id);
      await deleteBudget(row.id);
      addToast('Anggaran dihapus', 'success');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus anggaran';
      addToast(message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleCarryover = async (row: BudgetRowView, value: boolean) => {
    try {
      setProcessingId(row.id);
      await upsertBudget({
        id: row.id,
        categoryId: row.categoryId ?? '',
        amountPlanned: row.amountPlanned,
        period: row.periodMonth.slice(0, 7),
        carryoverEnabled: value,
        notes: row.notes ?? undefined,
      });
      await refresh();
      addToast('Pengaturan carryover disimpan', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui carryover';
      addToast(message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmit = async (values: BudgetFormValues) => {
    try {
      setSaving(true);
      await upsertBudget({
        id: editing?.id,
        categoryId: values.categoryId,
        amountPlanned: values.amountPlanned,
        period: values.period,
        carryoverEnabled: values.carryoverEnabled,
        notes: values.notes.trim() ? values.notes.trim() : undefined,
      });
      setDialogOpen(false);
      addToast('Anggaran tersimpan', 'success');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan anggaran';
      addToast(message, 'error');
    } finally {
      setSaving(false);
      setProcessingId(null);
    }
  };

  const showCustomInput = periodMode === 'custom';

  return (
    <Page title="Anggaran" subtitle="Atur rencana pengeluaran bulanan Anda.">
      <Section className="space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Anggaran</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Pantau realisasi anggaran pengeluaran dan kelola carryover tiap kategori.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1 rounded-2xl border border-white/40 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
              {[
                { label: 'Bulan ini', value: 'current' },
                { label: 'Bulan lalu', value: 'previous' },
                { label: 'Custom', value: 'custom' },
              ].map((option) => {
                const active = periodMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriodMode(option.value as PeriodMode)}
                    className={
                      active
                        ? 'h-11 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 px-4 text-sm font-semibold text-white shadow'
                        : 'h-11 rounded-2xl px-4 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {showCustomInput && (
              <label className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                <span className="hidden sm:inline">Periode</span>
                <span className="relative">
                  <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="month"
                    value={customPeriod}
                    onChange={(event) => setCustomPeriod(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200/70 bg-white/80 pl-10 pr-4 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-zinc-900/70 dark:text-slate-100"
                  />
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full flex-1">
            <BudgetSummaryCards summary={summary} loading={loading} />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={refresh}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200/70 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <Plus className="h-4 w-4" />
              Tambah Anggaran
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/80 p-4 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        )}

        <BudgetTable
          data={rows}
          loading={loading}
          processingId={processingId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleCarryover={handleToggleCarryover}
        />
      </Section>

      <BudgetFormDialog
        open={dialogOpen}
        categories={categories}
        loading={categoriesLoading}
        busy={saving}
        defaultPeriod={selectedPeriod}
        budget={editing}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </Page>
  );
}
