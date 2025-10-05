import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarRange, Plus, RefreshCw } from 'lucide-react';
import Page from '../../layout/Page';
import Section from '../../layout/Section';
import PageHeader from '../../layout/PageHeader';
import { useToast } from '../../context/ToastContext';
import SummaryCards from './components/SummaryCards';
import BudgetTable from './components/BudgetTable';
import BudgetFormModal, { type BudgetFormValues } from './components/BudgetFormModal';
import WeeklyBudgetFormModal, {
  type WeeklyBudgetFormValues,
} from './components/WeeklyBudgetFormModal';
import WeeklyBudgetsSection from './components/WeeklyBudgetsSection';
import { useBudgets } from '../../hooks/useBudgets';
import { useWeeklyBudgets } from '../../hooks/useWeeklyBudgets';
import { useBudgetHighlights } from '../../hooks/useBudgetHighlights';
import {
  deleteBudget,
  deleteWeeklyBudget,
  listCategoriesExpense,
  upsertBudget,
  upsertWeeklyBudget,
  type BudgetType,
  type BudgetWithSpent,
  type ExpenseCategory,
  type WeeklyBudgetWithActual,
} from '../../lib/budgetApi';

const VIEW_OPTIONS = [
  { value: 'monthly', label: 'Bulanan' },
  { value: 'weekly', label: 'Mingguan' },
] as const;

type ViewValue = (typeof VIEW_OPTIONS)[number]['value'];

type PeriodString = `${number}-${number}`;

function formatPeriod(date: Date): PeriodString {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}` as PeriodString;
}

function getCurrentPeriod(): PeriodString {
  return formatPeriod(new Date());
}

function isoToPeriod(isoDate: string | null | undefined): PeriodString {
  if (!isoDate) return getCurrentPeriod();
  return isoDate.slice(0, 7) as PeriodString;
}

function formatDateToISO(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function firstMondayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const weekday = firstDay.getUTCDay();
  const diff = weekday === 0 ? 1 : weekday === 1 ? 0 : 8 - weekday;
  firstDay.setUTCDate(firstDay.getUTCDate() + diff);
  return firstDay;
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const weekday = now.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  now.setUTCDate(now.getUTCDate() + diff);
  return formatDateToISO(now);
}

function getDefaultWeekStart(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return getCurrentWeekStart();
  }

  const now = new Date();
  if (now.getUTCFullYear() === year && now.getUTCMonth() + 1 === month) {
    const start = new Date(Date.UTC(year, month - 1, now.getUTCDate()));
    const weekday = start.getUTCDay();
    const diff = weekday === 0 ? -6 : 1 - weekday;
    start.setUTCDate(start.getUTCDate() + diff);
    if (start.getUTCMonth() === month - 1) {
      return formatDateToISO(start);
    }
  }

  return formatDateToISO(firstMondayOfMonth(year, month));
}

const DEFAULT_MONTHLY_FORM: BudgetFormValues = {
  period: getCurrentPeriod(),
  category_id: '',
  amount_planned: 0,
  carryover_enabled: false,
  notes: '',
};

export default function BudgetsPage() {
  const { addToast } = useToast();
  const [view, setView] = useState<ViewValue>('monthly');
  const [period, setPeriod] = useState<PeriodString>(getCurrentPeriod());
  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);
  const [editingMonthly, setEditingMonthly] = useState<BudgetWithSpent | null>(null);
  const [editingWeekly, setEditingWeekly] = useState<WeeklyBudgetWithActual | null>(null);
  const [submittingMonthly, setSubmittingMonthly] = useState(false);
  const [submittingWeekly, setSubmittingWeekly] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [highlightLoadingKey, setHighlightLoadingKey] = useState<string | null>(null);

  const monthly = useBudgets(period);
  const weekly = useWeeklyBudgets(period);
  const highlights = useBudgetHighlights();

  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    listCategoriesExpense()
      .then((data) => {
        if (!active) return;
        setCategories(data);
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Gagal memuat kategori';
        addToast(message, 'error');
      })
      .finally(() => {
        if (!active) return;
        setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [addToast]);

  useEffect(() => {
    if (monthly.error) {
      addToast(monthly.error, 'error');
    }
  }, [monthly.error, addToast]);

  useEffect(() => {
    if (weekly.error) {
      addToast(weekly.error, 'error');
    }
  }, [weekly.error, addToast]);

  const monthlyFormValues = useMemo<BudgetFormValues>(() => {
    if (editingMonthly) {
      return {
        period: isoToPeriod(editingMonthly.period_month),
        category_id: editingMonthly.category_id ?? '',
        amount_planned: Number(editingMonthly.amount_planned ?? 0),
        carryover_enabled: editingMonthly.carryover_enabled,
        notes: editingMonthly.notes ?? '',
      };
    }
    return { ...DEFAULT_MONTHLY_FORM, period };
  }, [editingMonthly, period]);

  const weeklyFormValues = useMemo<WeeklyBudgetFormValues>(() => {
    if (editingWeekly) {
      return {
        week_start: editingWeekly.week_start,
        category_id: editingWeekly.category_id ?? '',
        amount_planned: Number(editingWeekly.amount_planned ?? 0),
        notes: editingWeekly.notes ?? '',
      };
    }
    return {
      week_start: getDefaultWeekStart(period),
      category_id: '',
      amount_planned: 0,
      notes: '',
    };
  }, [editingWeekly, period]);

  const handleViewChange = (nextView: ViewValue) => {
    setView(nextView);
  };

  const handlePeriodChange = (value: string) => {
    if (!value) return;
    setPeriod(value as PeriodString);
  };

  const handleOpenCreate = () => {
    if (view === 'monthly') {
      setEditingMonthly(null);
      setMonthlyModalOpen(true);
    } else {
      setEditingWeekly(null);
      setWeeklyModalOpen(true);
    }
  };

  const handleEditMonthly = (row: BudgetWithSpent) => {
    setEditingMonthly(row);
    setMonthlyModalOpen(true);
  };

  const handleEditWeekly = (row: WeeklyBudgetWithActual) => {
    setEditingWeekly(row);
    setWeeklyModalOpen(true);
  };

  const handleDeleteMonthly = async (row: BudgetWithSpent) => {
    const confirmed = window.confirm(`Hapus anggaran untuk ${row.category?.name ?? 'kategori ini'}?`);
    if (!confirmed) return;
    try {
      setSubmittingMonthly(true);
      await deleteBudget(row.id);
      await monthly.refresh();
      addToast('Anggaran dihapus', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus anggaran';
      addToast(message, 'error');
    } finally {
      setSubmittingMonthly(false);
    }
  };

  const handleDeleteWeekly = async (row: WeeklyBudgetWithActual) => {
    const confirmed = window.confirm(`Hapus anggaran minggu ${row.week_start}?`);
    if (!confirmed) return;
    try {
      setSubmittingWeekly(true);
      await deleteWeeklyBudget(row.id);
      await weekly.refresh();
      addToast('Anggaran mingguan dihapus', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus anggaran mingguan';
      addToast(message, 'error');
    } finally {
      setSubmittingWeekly(false);
    }
  };

  const handleToggleCarryover = async (row: BudgetWithSpent, carryover: boolean) => {
    try {
      await upsertBudget({
        category_id: row.category_id,
        period: isoToPeriod(row.period_month),
        amount_planned: Number(row.amount_planned ?? 0),
        carryover_enabled: carryover,
        notes: row.notes ?? undefined,
      });
      await monthly.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui carryover';
      addToast(message, 'error');
    }
  };

  const handleSubmitMonthly = async (values: BudgetFormValues) => {
    try {
      setSubmittingMonthly(true);
      await upsertBudget({
        category_id: values.category_id,
        period: values.period,
        amount_planned: Number(values.amount_planned),
        carryover_enabled: values.carryover_enabled,
        notes: values.notes ? values.notes : undefined,
      });
      setMonthlyModalOpen(false);
      setEditingMonthly(null);
      addToast('Anggaran tersimpan', 'success');
      await monthly.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan anggaran';
      addToast(message, 'error');
    } finally {
      setSubmittingMonthly(false);
    }
  };

  const handleSubmitWeekly = async (values: WeeklyBudgetFormValues) => {
    try {
      setSubmittingWeekly(true);
      await upsertWeeklyBudget({
        id: editingWeekly?.id,
        category_id: values.category_id,
        week_start: values.week_start,
        amount_planned: Number(values.amount_planned),
        notes: values.notes ? values.notes : undefined,
      });
      setWeeklyModalOpen(false);
      setEditingWeekly(null);
      addToast('Anggaran mingguan tersimpan', 'success');
      await weekly.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan anggaran mingguan';
      addToast(message, 'error');
    } finally {
      setSubmittingWeekly(false);
    }
  };

  const handleHighlight = async (type: BudgetType, id: string, label: string) => {
    if (highlightLoadingKey) return;
    try {
      setHighlightLoadingKey(`${type}:${id}`);
      const result = await highlights.toggleHighlight(type, id);
      const successMessage =
        result === 'added'
          ? `${label} ditambahkan ke highlight`
          : `${label} dihapus dari highlight`;
      addToast(successMessage, 'success');
    } catch (err) {
      const limit = err instanceof Error && (err as { code?: string }).code === 'LIMIT_REACHED';
      if (limit) {
        addToast('Maks. 2 highlight', 'error');
      } else {
        const message = err instanceof Error ? err.message : 'Gagal mengubah highlight';
        addToast(message, 'error');
      }
    } finally {
      setHighlightLoadingKey(null);
    }
  };

  const handleHighlightMonthly = (row: BudgetWithSpent) => {
    const label = row.category?.name ?? 'Anggaran bulanan';
    void handleHighlight('monthly', row.id, label);
  };

  const handleHighlightWeekly = (row: WeeklyBudgetWithActual) => {
    const label = row.category?.name ?? 'Anggaran mingguan';
    void handleHighlight('weekly', row.id, label);
  };

  const handleRefresh = async () => {
    try {
      if (view === 'monthly') {
        await monthly.refresh();
      } else {
        await weekly.refresh();
      }
      addToast('Data anggaran diperbarui', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyegarkan data';
      addToast(message, 'error');
    }
  };

  const monthlyLoadingState = monthly.loading || submittingMonthly;
  const weeklyLoadingState = weekly.loading || submittingWeekly;

  return (
    <Page>
      <PageHeader title="Anggaran" description="Atur dan pantau alokasi pengeluaranmu tiap bulan.">
        <button
          type="button"
          onClick={handleRefresh}
          className="hidden h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:inline-flex"
        >
          <RefreshCw className="h-4 w-4" />
          Segarkan
        </button>
        <button
          type="button"
          disabled={categoriesLoading}
          onClick={handleOpenCreate}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Tambah anggaran
        </button>
      </PageHeader>

      <Section first>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex w-full gap-2 rounded-2xl border border-border/60 bg-surface/80 p-1 shadow-inner md:w-auto">
            {VIEW_OPTIONS.map(({ value, label }) => {
              const active = value === view;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleViewChange(value)}
                  className={clsx(
                    'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:flex-initial',
                    active
                      ? 'bg-brand text-brand-foreground shadow-lg shadow-brand/30'
                      : 'text-muted hover:text-text'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <label className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-surface/80 px-3 text-sm font-medium text-text shadow-inner transition focus-within:border-brand/40 focus-within:bg-brand/5 focus-within:text-text focus-within:outline-none focus-within:ring-2 focus-within:ring-brand/40">
            <CalendarRange className="h-4 w-4 text-muted" aria-hidden="true" />
            <input
              type="month"
              value={period}
              onChange={(event) => handlePeriodChange(event.target.value)}
              className="w-full appearance-none bg-transparent text-sm font-medium text-text outline-none"
              aria-label="Pilih bulan"
            />
          </label>
        </div>
      </Section>

      {view === 'monthly' ? (
        <Section>
          <SummaryCards summary={monthly.summary} loading={monthlyLoadingState} />
        </Section>
      ) : null}

      {(view === 'monthly' ? monthly.error : weekly.error) ? (
        <Section>
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 text-sm text-rose-600 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
            Terjadi kesalahan saat memuat data anggaran. Silakan coba lagi.
          </div>
        </Section>
      ) : null}

      <Section>
        {view === 'monthly' ? (
          <BudgetTable
            rows={monthly.rows}
            loading={monthlyLoadingState}
            onEdit={handleEditMonthly}
            onDelete={handleDeleteMonthly}
            onToggleCarryover={handleToggleCarryover}
            onToggleHighlight={handleHighlightMonthly}
            isHighlighted={(id) => highlights.isHighlighted('monthly', id)}
          />
        ) : (
          <WeeklyBudgetsSection
            rows={weekly.rows}
            summaries={weekly.summaries}
            loading={weeklyLoadingState}
            onEdit={handleEditWeekly}
            onDelete={handleDeleteWeekly}
            onHighlight={handleHighlightWeekly}
            isHighlighted={(id) => highlights.isHighlighted('weekly', id)}
          />
        )}
      </Section>

      <BudgetFormModal
        open={monthlyModalOpen}
        title={editingMonthly ? 'Edit anggaran' : 'Tambah anggaran'}
        categories={categories}
        initialValues={monthlyFormValues}
        submitting={submittingMonthly}
        onClose={() => {
          setMonthlyModalOpen(false);
          setEditingMonthly(null);
        }}
        onSubmit={handleSubmitMonthly}
      />

      <WeeklyBudgetFormModal
        open={weeklyModalOpen}
        title={editingWeekly ? 'Edit anggaran mingguan' : 'Tambah anggaran mingguan'}
        categories={categories}
        initialValues={weeklyFormValues}
        submitting={submittingWeekly}
        onClose={() => {
          setWeeklyModalOpen(false);
          setEditingWeekly(null);
        }}
        onSubmit={handleSubmitWeekly}
      />
    </Page>
  );
}
