import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Calendar, CalendarDays, Plus } from 'lucide-react';
import Page from '../../layout/Page';
import PageHeader from '../../layout/PageHeader';
import Section from '../../layout/Section';
import { useToast } from '../../context/ToastContext';
import SummaryCards from './components/SummaryCards';
import { BudgetCard, BudgetCardSkeleton } from './components/BudgetCard';
import BudgetFormModal, { type BudgetFormValues } from './components/BudgetFormModal';
import WeeklyBudgetFormModal, { type WeeklyBudgetFormValues } from './components/WeeklyBudgetFormModal';
import WeeklyPicker from './components/WeeklyPicker';
import MonthlyFromWeeklySummary from './components/MonthlyFromWeeklySummary';
import { useBudgets } from '../../hooks/useBudgets';
import { useWeeklyBudgets } from '../../hooks/useWeeklyBudgets';
import { useHighlightedBudgets } from '../../hooks/useHighlightedBudgets';
import {
  deleteBudget,
  deleteWeeklyBudget,
  listCategoriesExpense,
  type BudgetWithSpent,
  type ExpenseCategory,
  type WeeklyBudgetWithActual,
  upsertBudget,
  upsertWeeklyBudget,
} from '../../lib/budgetApi';

const VIEW_OPTIONS = [
  { value: 'monthly', label: 'Bulanan' },
  { value: 'weekly', label: 'Mingguan' },
] as const;

const LOCALE = 'id-ID';

type BudgetView = (typeof VIEW_OPTIONS)[number]['value'];

type WeeklyOption = {
  value: string;
  label: string;
  start: Date;
  end: Date;
};

function getCurrentPeriod() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function formatMonth(period: string) {
  const [year, month] = period.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month) return period;
  return new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function toWeekRangeLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
  const startLabel = formatter.format(start);
  const endLabel = formatter.format(end);
  return `Sen ${startLabel} – Min ${endLabel}`;
}

function getWeeksForPeriod(period: string): WeeklyOption[] {
  const [year, month] = period.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month) return [];
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const options: WeeklyOption[] = [];

  const firstMonday = (() => {
    const temp = new Date(startDate.getTime());
    const day = temp.getUTCDay();
    const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    temp.setUTCDate(temp.getUTCDate() + diff);
    return temp;
  })();

  let cursor = firstMonday;
  while (cursor < nextMonth) {
    const start = new Date(cursor.getTime());
    const end = new Date(cursor.getTime());
    end.setUTCDate(end.getUTCDate() + 6);
    if (end >= nextMonth) {
      end.setTime(nextMonth.getTime());
      end.setUTCDate(end.getUTCDate() - 1);
    }
    const label = toWeekRangeLabel(start, end);
    options.push({ value: cursor.toISOString().slice(0, 10), label, start, end });
    cursor = new Date(cursor.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return options;
}

function findDefaultWeek(period: string, options: WeeklyOption[]): string {
  const now = new Date();
  const [year, month] = period.split('-').map((part) => Number.parseInt(part, 10));
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const match = options.find((option) => today >= option.start && today <= option.end);
    if (match) return match.value;
  }
  return options[0]?.value ?? 'all';
}

const EMPTY_BUDGET_FORM: BudgetFormValues = {
  period: getCurrentPeriod(),
  category_id: '',
  amount_planned: 0,
  carryover_enabled: false,
  notes: '',
};

const EMPTY_WEEKLY_FORM: WeeklyBudgetFormValues = {
  week_start: '',
  category_id: '',
  amount_planned: 0,
  notes: '',
};

function toMonthlyFormValues(row: BudgetWithSpent): BudgetFormValues {
  return {
    period: row.period_month?.slice(0, 7) ?? getCurrentPeriod(),
    category_id: row.category_id ?? '',
    amount_planned: Number(row.amount_planned ?? 0),
    carryover_enabled: row.carryover_enabled,
    notes: row.notes ?? '',
  };
}

function toWeeklyFormValues(row: WeeklyBudgetWithActual): WeeklyBudgetFormValues {
  return {
    week_start: row.week_start,
    category_id: row.category_id,
    amount_planned: Number(row.amount_planned ?? 0),
    notes: row.notes ?? '',
  };
}

export default function BudgetsPage() {
  const { addToast } = useToast();
  const [view, setView] = useState<BudgetView>('monthly');
  const [period, setPeriod] = useState<string>(getCurrentPeriod());
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [monthlyModalOpen, setMonthlyModalOpen] = useState(false);
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false);
  const [editingMonthly, setEditingMonthly] = useState<BudgetWithSpent | null>(null);
  const [editingWeekly, setEditingWeekly] = useState<WeeklyBudgetWithActual | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const monthly = useBudgets(period);
  const weekly = useWeeklyBudgets(period);
  const highlights = useHighlightedBudgets({ period });

  const weeks = useMemo(() => getWeeksForPeriod(period), [period]);
  const defaultWeek = useMemo(() => findDefaultWeek(period, weeks), [period, weeks]);
  const [activeWeek, setActiveWeek] = useState<string>(defaultWeek);

  useEffect(() => {
    setActiveWeek(defaultWeek);
  }, [defaultWeek]);

  useEffect(() => {
    let active = true;
    setCategoriesLoading(true);
    listCategoriesExpense()
      .then((rows) => {
        if (!active) return;
        setCategories(rows);
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
    if (monthly.error) addToast(monthly.error, 'error');
  }, [monthly.error, addToast]);

  useEffect(() => {
    if (weekly.error) addToast(weekly.error, 'error');
  }, [weekly.error, addToast]);

  useEffect(() => {
    if (highlights.error) addToast(highlights.error, 'error');
  }, [highlights.error, addToast]);

  const highlightedMonthlyIds = useMemo(() => {
    return new Set(
      highlights.records.filter((record) => record.budget_type === 'monthly').map((record) => record.budget_id)
    );
  }, [highlights.records]);

  const highlightedWeeklyIds = useMemo(() => {
    return new Set(
      highlights.records.filter((record) => record.budget_type === 'weekly').map((record) => record.budget_id)
    );
  }, [highlights.records]);

  const weeklyTotalsSummary = useMemo(() => {
    const planned = weekly.summaries.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const actual = weekly.summaries.reduce((acc, row) => acc + Number(row.actual ?? 0), 0);
    const remaining = planned - actual;
    const percentage = planned > 0 ? Math.min(actual / planned, 1) : 0;
    return { planned, spent: actual, remaining, percentage };
  }, [weekly.summaries]);

  const periodLabel = useMemo(() => formatMonth(period), [period]);

  const filteredWeeklyRows = useMemo(() => {
    if (activeWeek === 'all') return weekly.rows;
    return weekly.rows.filter((row) => row.week_start === activeWeek);
  }, [weekly.rows, activeWeek]);

  const monthLink = (categoryId: string, start?: string, end?: string) => {
    const params = new URLSearchParams();
    params.set('category', categoryId);
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    else params.set('month', period);
    return `/transactions?${params.toString()}`;
  };

  const initialMonthlyValues = editingMonthly ? toMonthlyFormValues(editingMonthly) : { ...EMPTY_BUDGET_FORM, period };
  const initialWeeklyValues = editingWeekly
    ? toWeeklyFormValues(editingWeekly)
    : { ...EMPTY_WEEKLY_FORM, week_start: activeWeek === 'all' ? '' : activeWeek };

  const handleToggleHighlight = async (type: 'monthly' | 'weekly', id: string) => {
    try {
      const result = await highlights.toggle({ type, id });
      addToast(result === 'added' ? 'Ditambahkan ke highlight' : 'Highlight dihapus', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengubah highlight';
      if (message.toLowerCase().includes('maks')) {
        addToast('Maks. 2 highlight', 'error');
      } else {
        addToast(message, 'error');
      }
    }
  };

  const handleSubmitMonthly = async (values: BudgetFormValues) => {
    try {
      setSubmitting(true);
      await upsertBudget({
        category_id: values.category_id,
        period: values.period,
        amount_planned: Number(values.amount_planned),
        carryover_enabled: values.carryover_enabled,
        notes: values.notes || undefined,
      });
      addToast('Anggaran tersimpan', 'success');
      setMonthlyModalOpen(false);
      setEditingMonthly(null);
      await Promise.all([monthly.refresh(), highlights.refresh()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan anggaran';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitWeekly = async (values: WeeklyBudgetFormValues) => {
    try {
      setSubmitting(true);
      await upsertWeeklyBudget({
        id: editingWeekly?.id,
        category_id: values.category_id,
        week_start: values.week_start,
        amount_planned: Number(values.amount_planned),
        notes: values.notes || undefined,
      });
      addToast('Anggaran mingguan tersimpan', 'success');
      setWeeklyModalOpen(false);
      setEditingWeekly(null);
      await Promise.all([weekly.refresh(), highlights.refresh()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan anggaran mingguan';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMonthly = async (row: BudgetWithSpent) => {
    const confirmed = window.confirm(`Hapus anggaran ${row.category?.name ?? 'ini'}?`);
    if (!confirmed) return;
    try {
      setSubmitting(true);
      await deleteBudget(row.id);
      addToast('Anggaran dihapus', 'success');
      await Promise.all([monthly.refresh(), highlights.refresh()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus anggaran';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWeekly = async (row: WeeklyBudgetWithActual) => {
    const confirmed = window.confirm(`Hapus anggaran minggu ${row.week_start}?`);
    if (!confirmed) return;
    try {
      setSubmitting(true);
      await deleteWeeklyBudget(row.id);
      addToast('Anggaran mingguan dihapus', 'success');
      await Promise.all([weekly.refresh(), highlights.refresh()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus anggaran mingguan';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCarryover = async (row: BudgetWithSpent, carryover: boolean) => {
    try {
      await upsertBudget({
        category_id: row.category_id,
        period: row.period_month?.slice(0, 7) ?? period,
        amount_planned: Number(row.amount_planned ?? 0),
        carryover_enabled: carryover,
        notes: row.notes ?? undefined,
      });
      await Promise.all([monthly.refresh(), highlights.refresh()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memperbarui carryover';
      addToast(message, 'error');
    }
  };

  const weekOptions = useMemo(() => weeks.map(({ value, label }) => ({ value, label })), [weeks]);

  return (
    <Page>
      <PageHeader title="Anggaran" description="Pantau anggaran bulanan dan mingguanmu.">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-border/60 bg-surface/80 p-1 text-sm font-semibold text-muted shadow-inner">
            {VIEW_OPTIONS.map((option) => {
              const active = view === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setView(option.value)}
                  className={clsx(
                    'relative flex items-center gap-2 rounded-full px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                    active
                      ? 'bg-[color:var(--accent)] text-white shadow'
                      : 'text-muted hover:text-text'
                  )}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <label className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/80 px-3 py-2 text-sm font-medium text-text shadow-inner focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/40">
            <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
            <span className="sr-only">Pilih bulan</span>
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value || getCurrentPeriod())}
              className="bg-transparent text-sm font-medium text-text outline-none"
            />
          </label>
          <button
            type="button"
            disabled={categoriesLoading}
            onClick={() => {
              if (view === 'monthly') {
                setEditingMonthly(null);
                setMonthlyModalOpen(true);
              } else {
                setEditingWeekly(null);
                setWeeklyModalOpen(true);
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[color:var(--accent)] px-5 text-sm font-semibold text-white shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Tambah anggaran
          </button>
        </div>
      </PageHeader>

      {view === 'monthly' ? (
        <>
          <Section first>
            <SummaryCards summary={monthly.summary} loading={monthly.loading} />
          </Section>

          <Section>
            {monthly.loading && monthly.rows.length === 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <BudgetCardSkeleton key={index} />
                ))}
              </div>
            ) : monthly.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-surface/70 p-8 text-center text-sm text-muted shadow-inner">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent)]/15 text-[color:var(--accent)]">
                  <Plus className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text">Belum ada anggaran bulan {periodLabel}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMonthly(null);
                      setMonthlyModalOpen(true);
                    }}
                    className="text-sm font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
                  >
                    Tambah Anggaran
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {monthly.rows.map((row) => (
                  <BudgetCard
                    key={row.id}
                    name={row.category?.name ?? 'Tanpa kategori'}
                    categoryType={row.category?.type === 'income' ? 'income' : 'expense'}
                    planned={Number(row.amount_planned ?? 0)}
                    actual={Number(row.spent ?? 0)}
                    remaining={Number(row.remaining ?? 0)}
                    percentage={Number(row.amount_planned ?? 0) > 0 ? Number(row.spent ?? 0) / Number(row.amount_planned ?? 0) : 0}
                    periodLabel={periodLabel}
                    badge="Bulanan"
                    notes={row.notes}
                    carryoverEnabled={row.carryover_enabled}
                    onToggleCarryover={(value) => handleToggleCarryover(row, value)}
                    onEdit={() => {
                      setEditingMonthly(row);
                      setMonthlyModalOpen(true);
                    }}
                    onDelete={() => handleDeleteMonthly(row)}
                    highlightSelected={highlightedMonthlyIds.has(row.id)}
                    onToggleHighlight={() => handleToggleHighlight('monthly', row.id)}
                    linkToTransactions={monthLink(row.category_id)}
                  />
                ))}
              </div>
            )}
          </Section>
        </>
      ) : (
        <>
          <Section first>
            <SummaryCards summary={weeklyTotalsSummary} loading={weekly.loading} />
          </Section>

          <Section>
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface/80 p-5 shadow-sm supports-[backdrop-filter]:bg-surface/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-text dark:text-white">Ringkasan Weekly (Month-to-date)</h3>
                    <p className="text-sm text-muted">Akumulasi per kategori selama bulan {periodLabel}.</p>
                  </div>
                  <WeeklyPicker options={weekOptions} value={activeWeek} onChange={setActiveWeek} />
                </div>
                <MonthlyFromWeeklySummary rows={weekly.summaries} loading={weekly.loading} />
              </div>

              {weekly.loading && weekly.rows.length === 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <BudgetCardSkeleton key={index} />
                  ))}
                </div>
              ) : filteredWeeklyRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-surface/70 p-8 text-center text-sm text-muted shadow-inner">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent)]/15 text-[color:var(--accent)]">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-text">Belum ada anggaran minggu ini</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWeekly(null);
                        setWeeklyModalOpen(true);
                      }}
                      className="text-sm font-semibold text-[color:var(--accent)] underline-offset-4 hover:underline"
                    >
                      Tambah Anggaran
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredWeeklyRows.map((row) => {
                    const planned = Number(row.amount_planned ?? 0);
                    const actual = Number(row.actual ?? 0);
                    const weekEnd = row.week_end ?? row.week_start;
                    const linkStart = row.week_start;
                    const linkEnd = weekEnd;
                    return (
                      <BudgetCard
                        key={row.id}
                        name={row.category?.name ?? 'Tanpa kategori'}
                        categoryType={row.category?.type === 'income' ? 'income' : 'expense'}
                        planned={planned}
                        actual={actual}
                        remaining={row.remaining}
                        percentage={planned > 0 ? actual / planned : 0}
                        periodLabel={periodLabel}
                        badge="Mingguan"
                        notes={row.notes}
                        onEdit={() => {
                          setEditingWeekly(row);
                          setWeeklyModalOpen(true);
                        }}
                        onDelete={() => handleDeleteWeekly(row)}
                        highlightSelected={highlightedWeeklyIds.has(row.id)}
                        onToggleHighlight={() => handleToggleHighlight('weekly', row.id)}
                        linkToTransactions={monthLink(row.category_id, linkStart, linkEnd)}
                        weekRangeLabel={toWeekRangeLabel(new Date(`${row.week_start}T00:00:00.000Z`), new Date(`${weekEnd}T00:00:00.000Z`))}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </Section>
        </>
      )}

      <BudgetFormModal
        open={monthlyModalOpen}
        title={editingMonthly ? 'Edit anggaran' : 'Tambah anggaran'}
        categories={categories}
        initialValues={initialMonthlyValues}
        submitting={submitting}
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
        weekOptions={weekOptions}
        initialValues={initialWeeklyValues}
        submitting={submitting}
        onClose={() => {
          setWeeklyModalOpen(false);
          setEditingWeekly(null);
        }}
        onSubmit={handleSubmitWeekly}
      />
    </Page>
  );
}
