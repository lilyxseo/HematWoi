import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
} from 'lucide-react';
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
  getFirstWeekStartOfPeriod,
  type BudgetWithSpent,
  type ExpenseCategory,
  type HighlightBudgetSelection,
  type WeeklyBudgetWithSpent,
  type WeeklyBudgetPeriod,
} from '../../lib/budgetApi';

const TABS = [
  { value: 'monthly', label: 'Bulanan', icon: CalendarDays },
  { value: 'weekly', label: 'Mingguan', icon: CalendarRange },
] as const;

type TabValue = (typeof TABS)[number]['value'];

type ViewTransactionsParams = {
  categoryId?: string | null;
  categoryType?: 'income' | 'expense' | null;
  range: 'month' | 'custom';
  month?: string;
  start?: string;
  end?: string;
};

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
  carryover_enabled: false,
  notes: '',
};

const WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
});

function formatWeekRangeLabel(start: string, end: string): string {
  try {
    const startLabel = WEEK_RANGE_FORMATTER.format(new Date(`${start}T00:00:00.000Z`));
    const endLabel = WEEK_RANGE_FORMATTER.format(new Date(`${end}T00:00:00.000Z`));
    return `${startLabel} – ${endLabel}`;
  } catch (error) {
    return `${start} – ${end}`;
  }
}

function formatWeekTitle(sequence: number): string {
  return `Minggu ke ${sequence}`;
}

function formatWeekOptionLabel(week: WeeklyBudgetPeriod): string {
  return `${formatWeekTitle(week.sequence)} (${formatWeekRangeLabel(week.start, week.end)})`;
}

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
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);

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

  useEffect(() => {
    setSelectedWeekStart(null);
  }, [period]);

  useEffect(() => {
    if (weekly.weeks.length === 0) {
      setSelectedWeekStart(null);
      return;
    }
    setSelectedWeekStart((prev) => {
      if (prev && weekly.weeks.some((week) => week.start === prev)) {
        return prev;
      }

      const [yearStr, monthStr] = period.split('-');
      const parsedYear = Number.parseInt(yearStr ?? '', 10);
      const parsedMonth = Number.parseInt(monthStr ?? '', 10) - 1;
      const fallbackNow = new Date();
      const reference = Number.isFinite(parsedYear) && Number.isFinite(parsedMonth)
        ? new Date(Date.UTC(parsedYear, parsedMonth, 1))
        : new Date(Date.UTC(fallbackNow.getUTCFullYear(), fallbackNow.getUTCMonth(), 1));
      const referencePeriod = `${reference.getUTCFullYear()}-${`${reference.getUTCMonth() + 1}`.padStart(2, '0')}`;
      const currentPeriod = getCurrentPeriod();
      const targetIso = referencePeriod === currentPeriod
        ? new Date().toISOString().slice(0, 10)
        : reference.toISOString().slice(0, 10);

      const preferred = weekly.weeks.find((week) => targetIso >= week.start && targetIso <= week.end);
      return preferred?.start ?? weekly.weeks[0]?.start ?? prev;
    });
  }, [period, weekly.weeks]);

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
        carryover_enabled: editingWeekly.carryover_enabled,
        notes: editingWeekly.notes ?? '',
      };
    }
    const fallbackWeek = selectedWeekStart ?? getFirstWeekStartOfPeriod(period);
    return {
      ...DEFAULT_WEEKLY_FORM,
      week_start: fallbackWeek,
    };
  }, [editingWeekly, period, selectedWeekStart]);

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

  const highlightedWeeklyCategoryIds = useMemo(() => {
    const categoryIds = new Set<string>();
    for (const selection of highlightSelections) {
      if (selection.budget_type !== 'weekly') continue;
      const match = weekly.rows.find((row) => String(row.id) === String(selection.budget_id));
      if (match?.category_id) {
        categoryIds.add(String(match.category_id));
      }
    }
    return categoryIds;
  }, [highlightSelections, weekly.rows]);

  const selectedWeek = useMemo(() => {
    if (!selectedWeekStart) return null;
    return weekly.weeks.find((week) => week.start === selectedWeekStart) ?? null;
  }, [selectedWeekStart, weekly.weeks]);

  const weeklyRowsForDisplay = useMemo(() => {
    if (!selectedWeek) return weekly.rows;
    return weekly.rows.filter((row) => row.week_start === selectedWeek.start);
  }, [weekly.rows, selectedWeek]);

  const weekSelector = useMemo(() => {
    if (weekly.weeks.length === 0) {
      return null;
    }
    const currentIndex = selectedWeek
      ? weekly.weeks.findIndex((week) => week.start === selectedWeek.start)
      : -1;
    const total = weekly.weeks.length;
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < total - 1;

    const goTo = (offset: number) => {
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      const next = weekly.weeks[baseIndex + offset];
      if (next) {
        setSelectedWeekStart(next.start);
      }
    };

    const selectValue = selectedWeekStart ?? weekly.weeks[0]?.start ?? '';

    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text">
              {selectedWeek ? formatWeekTitle(selectedWeek.sequence) : 'Pilih minggu'}
            </p>
            {selectedWeek ? (
              <p className="text-xs text-muted">
                {`Minggu ke ${selectedWeek.sequence} dari ${total} • Periode ${formatWeekRangeLabel(selectedWeek.start, selectedWeek.end)}`}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(-1)}
              disabled={!hasPrev}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface/70 text-muted shadow-sm transition hover:-translate-y-0.5 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Minggu sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="relative">
              <select
                value={selectValue}
                onChange={(event) => setSelectedWeekStart(event.target.value || null)}
                className="h-9 min-w-[10rem] appearance-none rounded-xl border border-border/60 bg-surface/90 px-3 pr-10 text-sm font-medium text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                aria-label="Pilih minggu"
              >
                {weekly.weeks.map((week) => (
                  <option key={week.start} value={week.start}>
                    {formatWeekOptionLabel(week)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={!hasNext}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface/70 text-muted shadow-sm transition hover:-translate-y-0.5 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Minggu selanjutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }, [selectedWeek, selectedWeekStart, weekly.weeks]);

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

  const handleToggleWeeklyCarryover = async (row: WeeklyBudgetWithSpent, carryover: boolean) => {
    try {
      await upsertWeeklyBudget({
        id: row.id,
        category_id: row.category_id,
        week_start: row.week_start,
        amount_planned: Number(row.amount_planned ?? 0),
        carryover_enabled: carryover,
        notes: row.notes ?? undefined,
      });
      await weekly.refresh();
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
        carryover_enabled: values.carryover_enabled,
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

  const handleViewTransactions = ({
    categoryId,
    categoryType,
    range,
    month: monthParam,
    start,
    end,
  }: ViewTransactionsParams) => {
    const params = new URLSearchParams();
    params.set('range', range);

    if (range === 'month') {
      const monthValue = monthParam ?? period;
      params.set('month', monthValue);
      params.delete('start');
      params.delete('end');
    } else {
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      params.delete('month');
    }

    if (categoryId) {
      params.set('categories', categoryId);
    }

    if (categoryType === 'income' || categoryType === 'expense') {
      params.set('type', categoryType);
    }

    navigate(`/transactions?${params.toString()}`);
  };

  const handleToggleHighlight = async (
    type: 'monthly' | 'weekly',
    id: string,
    categoryId?: string | null
  ) => {
    try {
      setHighlightLoading(true);
      if (type === 'weekly' && categoryId) {
        const normalizedCategoryId = String(categoryId);
        const selectionForCategory = highlightSelections.find((selection) => {
          if (selection.budget_type !== 'weekly') return false;
          const match = weekly.rows.find((row) => String(row.id) === String(selection.budget_id));
          if (!match?.category_id) return false;
          return String(match.category_id) === normalizedCategoryId;
        });

        if (selectionForCategory && String(selectionForCategory.budget_id) !== String(id)) {
          const result = await toggleHighlight({ type, id: String(selectionForCategory.budget_id) });
          setHighlightSelections(result.highlights);
          addToast(result.highlighted ? 'Highlight ditambahkan' : 'Highlight dihapus', 'success');
          return;
        }
      }

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
    <Page maxWidthClassName="max-w-[1400px]" paddingClassName="px-3 md:px-6">
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
            {weekSelector}
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
            onViewTransactions={(row) =>
              handleViewTransactions({
                categoryId: row.category_id,
                categoryType: row.category?.type ?? null,
                range: 'month',
                month: row.period_month?.slice(0, 7) ?? period,
              })
            }
            onToggleHighlight={(row) => handleToggleHighlight('monthly', String(row.id), row.category_id)}
          />
        </Section>
      ) : (
        <Section>
          <WeeklyBudgetsGrid
            rows={weeklyRowsForDisplay}
            loading={weeklyLoading}
            highlightedIds={highlightedWeeklyIds}
            highlightedCategoryIds={highlightedWeeklyCategoryIds}
            highlightLimitReached={highlightLimitReached}
            onEdit={handleEditWeekly}
            onDelete={handleDeleteWeekly}
            onViewTransactions={(row) =>
              handleViewTransactions({
                categoryId: row.category_id,
                categoryType: row.category?.type ?? null,
                range: 'custom',
                start: row.week_start,
                end: row.week_end,
              })
            }
            onToggleCarryover={handleToggleWeeklyCarryover}
            onToggleHighlight={(row) => handleToggleHighlight('weekly', String(row.id), row.category_id)}
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

