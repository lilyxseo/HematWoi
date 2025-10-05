import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, CalendarRange, Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Page from '../../layout/Page';
import Section from '../../layout/Section';
import PageHeader from '../../layout/PageHeader';
import { useToast } from '../../context/ToastContext';
import SummaryCards from './components/SummaryCards';
import BudgetTable from './components/BudgetTable';
import BudgetFormModal, { type BudgetFormValues } from './components/BudgetFormModal';
import WeeklyBudgetsGrid from './components/WeeklyBudgetsGrid';
import WeeklyBudgetFormModal, { type WeeklyBudgetFormValues } from './components/WeeklyBudgetFormModal';
import MonthlyFromWeeklySummary from './components/MonthlyFromWeeklySummary';
import { useBudgets } from '../../hooks/useBudgets';
import { useWeeklyBudgets } from '../../hooks/useWeeklyBudgets';
import {
  deleteBudget,
  deleteWeeklyBudget,
  listCategoriesExpense,
  listHighlightBudgets,
  toggleHighlight,
  upsertBudget,
  upsertWeeklyBudget,
  type BudgetWithSpent,
  type ExpenseCategory,
  type HighlightBudgetSelection,
  type WeeklyBudgetWithSpent,
} from '../../lib/budgetApi';

const TABS = [
  { value: 'monthly', label: 'Bulanan', icon: CalendarDays },
  { value: 'weekly', label: 'Mingguan', icon: CalendarRange },
] as const;

type TabValue = (typeof TABS)[number]['value'];

function formatPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function getCurrentPeriod() {
  return formatPeriod(new Date());
}

function toHumanReadable(period: string): string {
  const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !month) return period;
  const formatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
  return formatter.format(new Date(year, month - 1, 1));
}

function isoToPeriod(isoDate: string | null | undefined): string {
  if (!isoDate) return getCurrentPeriod();
  return isoDate.slice(0, 7);
}

function getFirstWeekStartOfPeriod(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  const year = Number.parseInt(yearStr ?? '', 10);
  const month = Number.parseInt(monthStr ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return getCurrentPeriod();
  }
  const date = new Date(Date.UTC(year, month - 1, 1));
  const day = date.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  const startYear = date.getUTCFullYear();
  const startMonth = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const startDay = `${date.getUTCDate()}`.padStart(2, '0');
  return `${startYear}-${startMonth}-${startDay}`;
}

const DEFAULT_MONTHLY_FORM: BudgetFormValues = {
  period: getCurrentPeriod(),
  category_id: '',
  amount_planned: 0,
  carryover_enabled: false,
  notes: '',
};

const DEFAULT_WEEKLY_FORM: WeeklyBudgetFormValues = {
  week_start: getFirstWeekStartOfPeriod(getCurrentPeriod()),
  category_id: '',
  amount_planned: 0,
  notes: '',
};

export default function BudgetsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [tab, setTab] = useState<TabValue>('monthly');
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);
  const [editingMonthly, setEditingMonthly] = useState<BudgetWithSpent | null>(null);
  const [editingWeekly, setEditingWeekly] = useState<WeeklyBudgetWithSpent | null>(null);
  const [submittingMonthly, setSubmittingMonthly] = useState(false);
  const [submittingWeekly, setSubmittingWeekly] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [highlightSelections, setHighlightSelections] = useState<HighlightBudgetSelection[]>([]);
  const [highlightLoading, setHighlightLoading] = useState(true);

  const monthly = useBudgets(period);
  const weekly = useWeeklyBudgets(period);

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
    let active = true;
    setHighlightLoading(true);
    listHighlightBudgets()
      .then((data) => {
        if (!active) return;
        setHighlightSelections(data);
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Gagal memuat highlight';
        addToast(message, 'error');
      })
      .finally(() => {
        if (!active) return;
        setHighlightLoading(false);
      });
    return () => {
      active = false;
    };
  }, [addToast]);

  useEffect(() => {
    if (tab === 'monthly' && monthly.error) {
      addToast(monthly.error, 'error');
    }
  }, [tab, monthly.error, addToast]);

  useEffect(() => {
    if (tab === 'weekly' && weekly.error) {
      addToast(weekly.error, 'error');
    }
  }, [tab, weekly.error, addToast]);

  const monthlyInitialValues = useMemo<BudgetFormValues>(() => {
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

  const weeklyInitialValues = useMemo<WeeklyBudgetFormValues>(() => {
    if (editingWeekly) {
      return {
        week_start: editingWeekly.week_start,
        category_id: editingWeekly.category_id ?? '',
        amount_planned: Number(editingWeekly.amount_planned ?? 0),
        notes: editingWeekly.notes ?? '',
      };
    }
    return {
      ...DEFAULT_WEEKLY_FORM,
      week_start: getFirstWeekStartOfPeriod(period),
    };
  }, [editingWeekly, period]);

  const highlightedMonthlyIds = useMemo(() => {
    return new Set(
      highlightSelections
        .filter((item) => item.budget_type === 'monthly')
        .map((item) => String(item.budget_id))
    );
  }, [highlightSelections]);

  const highlightedWeeklyIds = useMemo(() => {
    return new Set(
      highlightSelections
        .filter((item) => item.budget_type === 'weekly')
        .map((item) => String(item.budget_id))
    );
  }, [highlightSelections]);

  const highlightLimitReached = !highlightLoading && highlightSelections.length >= 2;

  const handleTabChange = (value: TabValue) => {
    setTab(value);
  };

  const handlePeriodChange = (value: string) => {
    if (!value) return;
    setPeriod(value);
  };

  const handleRefresh = () => {
    if (tab === 'monthly') {
      void monthly.refresh();
    } else {
      void weekly.refresh();
    }
  };

  const handleOpenCreate = () => {
    if (tab === 'monthly') {
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

  const handleEditWeekly = (row: WeeklyBudgetWithSpent) => {
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

  const handleDeleteWeekly = async (row: WeeklyBudgetWithSpent) => {
    const confirmed = window.confirm(`Hapus anggaran minggu ${row.week_start}?`);
    if (!confirmed) return;
    try {
      setSubmittingWeekly(true);
      await deleteWeeklyBudget(row.id);
      await weekly.refresh();
      addToast('Anggaran mingguan dihapus', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menghapus anggaran';
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

  const handleViewTransactions = (categoryId: string, week?: { start: string; end: string }) => {
    const params = new URLSearchParams();
    params.set('category', categoryId);
    params.set('period', period);
    if (week) {
      params.set('week_start', week.start);
      params.set('week_end', week.end);
    }
    navigate(`/transactions?${params.toString()}`);
  };

  const handleToggleHighlight = async (type: 'monthly' | 'weekly', id: string) => {
    try {
      setHighlightLoading(true);
      const result = await toggleHighlight({ type, id });
      setHighlightSelections(result.highlights);
      addToast(result.highlighted ? 'Highlight ditambahkan' : 'Highlight dihapus', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui highlight';
      if (message.toLowerCase().includes('maks')) {
        addToast('Maks. 2 highlight', 'error');
      } else {
        addToast(message, 'error');
      }
    } finally {
      setHighlightLoading(false);
    }
  };

  const monthlyLoading = monthly.loading || submittingMonthly;
  const weeklyLoading = weekly.loading || submittingWeekly;

  return (
    <Page>
      <PageHeader
        title="Anggaran"
        description="Atur dan pantau alokasi pengeluaranmu per bulan atau per minggu."
      >
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
          <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:auto-cols-fr md:grid-flow-col">
            {TABS.map(({ value, label, icon: Icon }) => {
              const active = value === tab;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleTabChange(value)}
                  className={clsx(
                    'group inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                    active
                      ? 'border-transparent bg-brand text-brand-foreground shadow-lg shadow-brand/30'
                      : 'border-border/60 bg-surface/80 text-muted hover:bg-surface hover:text-text'
                  )}
                >
                  <Icon
                    className={clsx(
                      'h-4 w-4 transition-colors',
                      active ? 'text-brand-foreground' : 'text-muted group-hover:text-text'
                    )}
                  />
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
              aria-label="Pilih periode bulan"
            />
            <span className="hidden text-xs text-muted md:inline">{toHumanReadable(period)}</span>
          </label>
        </div>
      </Section>

      {tab === 'monthly' ? (
        <Section>
          <SummaryCards summary={monthly.summary} loading={monthlyLoading} />
        </Section>
      ) : (
        <Section>
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-text">Total Weekly (Month-to-date)</h2>
            <MonthlyFromWeeklySummary summary={weekly.summaryByCategory} loading={weeklyLoading} />
          </div>
        </Section>
      )}

      {tab === 'monthly' ? (
        <Section>
          <BudgetTable
            rows={monthly.rows}
            loading={monthlyLoading}
            highlightedIds={highlightedMonthlyIds}
            highlightLimitReached={highlightLimitReached}
            onEdit={handleEditMonthly}
            onDelete={handleDeleteMonthly}
            onToggleCarryover={handleToggleCarryover}
            onViewTransactions={(row) => handleViewTransactions(row.category_id ?? '', undefined)}
            onToggleHighlight={(row) => handleToggleHighlight('monthly', row.id)}
          />
        </Section>
      ) : (
        <Section>
          <WeeklyBudgetsGrid
            rows={weekly.rows}
            loading={weeklyLoading}
            highlightedIds={highlightedWeeklyIds}
            highlightLimitReached={highlightLimitReached}
            onEdit={handleEditWeekly}
            onDelete={handleDeleteWeekly}
            onViewTransactions={(row) =>
              handleViewTransactions(row.category_id ?? '', { start: row.week_start, end: row.week_end })
            }
            onToggleHighlight={(row) => handleToggleHighlight('weekly', row.id)}
          />
        </Section>
      )}

      <BudgetFormModal
        open={monthlyModalOpen}
        title={editingMonthly ? 'Edit anggaran' : 'Tambah anggaran'}
        categories={categories}
        initialValues={monthlyInitialValues}
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
        initialValues={weeklyInitialValues}
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

