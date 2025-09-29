import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Page from '../../layout/Page';
import Breadcrumbs from '../../layout/Breadcrumbs';
import { useBudgets } from '../../hooks/useBudgets';
import { useToast } from '../../context/ToastContext';
import {
  createBudget,
  getMonthRange,
  invalidateBudgetsCache,
  toMonthStart,
  updateBudget,
  type BudgetWithActual,
} from '../../lib/budgetsApi';
import { listCategories, type CategoryRecord } from '../../lib/api-categories';
import { formatCurrency } from '../../lib/format.js';
import BudgetFilters from './components/BudgetFilters';
import BudgetCard from './components/BudgetCard';
import BudgetFormDialog, {
  type BudgetCategoryOption,
  type BudgetFormValues,
} from './components/BudgetFormDialog';
import {
  ArrowRightIcon,
  InfoIcon,
  PlusIcon,
  RefreshIcon,
} from '../../components/budgets/InlineIcons';

const SKELETON_COUNT = 8;

function getCurrentPeriod(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function toHumanReadable(period: string): string {
  const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
  if (!year || !month) return period;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
}

function clampPeriod(period: string | null | undefined): string {
  if (!period) return getCurrentPeriod();
  if (/^\d{4}-\d{2}$/.test(period)) return period;
  return getCurrentPeriod();
}

function toNextPeriod(period: string): string {
  const [year, month] = period.split('-').map((value) => Number.parseInt(value, 10));
  const date = new Date(year, (month ?? 1) - 1, 1);
  date.setMonth(date.getMonth() + 1);
  const nextMonth = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}`;
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveEndOfMonth(period: string): string {
  const { end } = getMonthRange(period);
  const endDate = new Date(`${end}T00:00:00`);
  endDate.setDate(endDate.getDate() - 1);
  return formatDateISO(endDate);
}

function mapCategoryRecord(category: CategoryRecord): BudgetCategoryOption {
  return {
    id: category.id,
    name: category.name,
    type: category.type === 'income' ? 'income' : 'expense',
    group_name: (category as { group_name?: string | null }).group_name ?? null,
  };
}

const DEFAULT_FORM_VALUES: BudgetFormValues = {
  period: getCurrentPeriod(),
  categoryId: '',
  amount: 0,
  carryover: false,
  notes: '',
};

type BudgetTypeFilter = 'all' | 'expense' | 'income';

type GroupedBudgets = {
  group: string;
  items: BudgetWithActual[];
};

function buildInitialValues(period: string, editing?: BudgetWithActual | null): BudgetFormValues {
  if (!editing) {
    return { ...DEFAULT_FORM_VALUES, period };
  }
  return {
    period: editing.period_month?.slice(0, 7) ?? period,
    categoryId: editing.category_id,
    amount: Number(editing.planned ?? editing.amount_planned ?? 0),
    carryover: Boolean(editing.carryover_enabled),
    notes: editing.notes ?? '',
  };
}

export default function BudgetsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = clampPeriod(searchParams.get('period'));
  const typeFilter = (searchParams.get('type') as BudgetTypeFilter) ?? 'expense';
  const searchQuery = searchParams.get('q') ?? '';
  const groupBy = searchParams.get('group') === 'true';

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithActual | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<BudgetCategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [autoRollover, setAutoRollover] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage?.getItem('hw-auto-rollover') === '1';
  });

  const { rows, summary, loading, error, refresh } = useBudgets(period);

  const updateParams = useCallback(
    (updates: Record<string, string | boolean | null | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    setCategoriesLoading(true);
    const controller = new AbortController();
    listCategories(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setCategories(data.map(mapCategoryRecord));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Gagal memuat kategori';
        addToast(message, 'error');
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setCategoriesLoading(false);
      });
    return () => controller.abort();
  }, [addToast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem('hw-auto-rollover', autoRollover ? '1' : '0');
    }
  }, [autoRollover]);

  const handlePeriodChange = useCallback(
    (value: string) => {
      updateParams({ period: value || getCurrentPeriod() });
    },
    [updateParams]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateParams({ q: value || null });
    },
    [updateParams]
  );

  const handleTypeChange = useCallback(
    (value: BudgetTypeFilter) => {
      updateParams({ type: value === 'expense' ? 'expense' : value === 'income' ? 'income' : 'all' });
    },
    [updateParams]
  );

  const handleGroupToggle = useCallback(
    (value: boolean) => {
      updateParams({ group: value ? 'true' : null });
    },
    [updateParams]
  );

  const filteredBudgets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return rows
      .filter((budget) => {
        if (typeFilter === 'all') return true;
        const categoryType = budget.category?.type ?? 'expense';
        return categoryType === typeFilter;
      })
      .filter((budget) => {
        if (!normalizedQuery) return true;
        const source = `${budget.category?.name ?? ''} ${budget.category?.group_name ?? ''}`.toLowerCase();
        return source.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aName = a.category?.name ?? '';
        const bName = b.category?.name ?? '';
        return aName.localeCompare(bName, 'id-ID', { sensitivity: 'base' });
      });
  }, [rows, searchQuery, typeFilter]);

  const groupedBudgets = useMemo<GroupedBudgets[]>(() => {
    if (!groupBy) return [];
    const groups = new Map<string, BudgetWithActual[]>();
    filteredBudgets.forEach((budget) => {
      const key = budget.category?.group_name?.trim() || 'Tanpa grup';
      const groupItems = groups.get(key) ?? [];
      groupItems.push(budget);
      groups.set(key, groupItems);
    });
    return Array.from(groups.entries())
      .map(([group, items]) => ({ group, items }))
      .sort((a, b) => {
        if (a.group === 'Tanpa grup') return 1;
        if (b.group === 'Tanpa grup') return -1;
        return a.group.localeCompare(b.group, 'id-ID', { sensitivity: 'base' });
      });
  }, [filteredBudgets, groupBy]);

  const initialFormValues = useMemo(() => buildInitialValues(period, editing), [period, editing]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (budget: BudgetWithActual) => {
    setEditing(budget);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSubmit = async (values: BudgetFormValues) => {
    try {
      setSubmitting(true);
      if (editing) {
        await updateBudget(
          editing.id,
          {
            amount: values.amount,
            carryover_enabled: values.carryover,
            notes: values.notes.trim() ? values.notes : null,
          },
          values.period
        );
        addToast('Anggaran diperbarui', 'success');
      } else {
        await createBudget({
          category_id: values.categoryId,
          amount: values.amount,
          carryover_enabled: values.carryover,
          notes: values.notes.trim() ? values.notes : null,
          period: values.period,
        });
        addToast('Anggaran ditambahkan', 'success');
      }
      invalidateBudgetsCache(values.period);
      closeForm();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan anggaran';
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCarryover = async (budget: BudgetWithActual, next: boolean) => {
    try {
      await updateBudget(
        budget.id,
        {
          carryover_enabled: next,
        },
        budget.period_month?.slice(0, 7) ?? period
      );
      invalidateBudgetsCache(period);
      addToast(next ? 'Carryover diaktifkan' : 'Carryover dinonaktifkan', 'success');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengubah carryover';
      addToast(message, 'error');
    }
  };

  const handleRollover = async (budget: BudgetWithActual) => {
    if (budget.remaining <= 0) {
      addToast('Tidak ada sisa anggaran untuk di-rollover', 'info');
      return;
    }
    const nextPeriod = toNextPeriod(budget.period_month?.slice(0, 7) ?? period);
    try {
      await createBudget({
        category_id: budget.category_id,
        period: nextPeriod,
        amount: Math.max(budget.planned, 0) + Math.max(budget.remaining, 0),
        carryover_enabled: Boolean(budget.carryover_enabled),
        notes: budget.notes ?? null,
      });
      invalidateBudgetsCache(nextPeriod);
      addToast('Rollover ke bulan berikutnya dibuat', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membuat rollover';
      addToast(message, 'error');
    }
  };

  const handleViewTransactions = (budget: BudgetWithActual) => {
    const basePeriod = budget.period_month?.slice(0, 7) ?? period;
    const start = toMonthStart(basePeriod);
    const end = resolveEndOfMonth(basePeriod);
    navigate(`/transactions?category=${budget.category_id}&start=${start}&end=${end}`);
  };

  const toggleAutoRollover = () => {
    const next = !autoRollover;
    setAutoRollover(next);
    addToast(next ? 'Rollover otomatis akan diterapkan (simulasi)' : 'Rollover otomatis dimatikan', 'info');
  };

  const renderSkeletons = () => (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
        <div
          key={index}
          className="h-48 animate-pulse rounded-2xl bg-slate-900/80 ring-1 ring-slate-800"
        />
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl bg-slate-900/80 px-10 py-14 text-center ring-1 ring-slate-800">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
        <InfoIcon className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-100">Belum ada anggaran untuk filter ini</h3>
        <p className="text-sm text-slate-400">
          Tambahkan anggaran baru atau ubah filter pencarian untuk melihat daftar anggaran.
        </p>
      </div>
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-slate-950 shadow hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
      >
        <PlusIcon className="h-4 w-4" />
        Tambah anggaran
      </button>
    </div>
  );

  const canShowGrouped = groupBy && groupedBudgets.length > 0;

  return (
    <Page>
      <div className="space-y-8">
        <div className="space-y-6">
          <Breadcrumbs />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                Anggaran Bulan Ini
              </span>
              <div>
                <h1 className="text-2xl font-semibold text-slate-100 md:text-3xl">
                  {toHumanReadable(period)}
                </h1>
                <p className="text-sm text-slate-400">
                  Pantau pemakaian anggaran dan ambil tindakan cepat sebelum terlambat.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAutoRollover}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
                  autoRollover
                    ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                    : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                )}
              >
                <ArrowRightIcon className="h-4 w-4" />
                Rollover Otomatis
              </button>
              <button
                type="button"
                onClick={openCreate}
                disabled={categoriesLoading}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-slate-950 shadow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PlusIcon className="h-4 w-4" />
                Tambah Anggaran
              </button>
            </div>
          </div>

          <BudgetFilters
            period={period}
            search={searchQuery}
            type={typeFilter}
            groupBy={groupBy}
            onPeriodChange={handlePeriodChange}
            onSearchChange={handleSearchChange}
            onTypeChange={handleTypeChange}
            onGroupByChange={handleGroupToggle}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">Planned</p>
              <p className="mt-1 font-mono text-lg text-slate-100">{formatCurrency(summary.planned, 'IDR')}</p>
            </div>
            <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">Actual MTD</p>
              <p className="mt-1 font-mono text-lg text-slate-100">{formatCurrency(summary.actual, 'IDR')}</p>
            </div>
            <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">Remaining</p>
              <p
                className={clsx(
                  'mt-1 font-mono text-lg',
                  summary.remaining < 0 ? 'text-rose-300' : 'text-emerald-300'
                )}
              >
                {formatCurrency(summary.remaining, 'IDR')}
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
            <span>Terjadi kesalahan saat memuat data anggaran.</span>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-full border border-red-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-200 transition hover:bg-red-500/10"
            >
              <RefreshIcon className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : null}

        {loading && !rows.length ? (
          renderSkeletons()
        ) : filteredBudgets.length === 0 ? (
          renderEmptyState()
        ) : canShowGrouped ? (
          <div className="space-y-8">
            {groupedBudgets.map((group) => (
              <section key={group.group} className="space-y-3">
                <header className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {group.group}
                  </h3>
                  <span className="text-xs text-slate-500">{group.items.length} kategori</span>
                </header>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((budget) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      onEdit={openEdit}
                      onViewTransactions={handleViewTransactions}
                      onToggleCarryover={handleToggleCarryover}
                      onRollover={handleRollover}
                      rolloverEnabled={autoRollover}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredBudgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onEdit={openEdit}
                onViewTransactions={handleViewTransactions}
                onToggleCarryover={handleToggleCarryover}
                onRollover={handleRollover}
                rolloverEnabled={autoRollover}
              />
            ))}
          </div>
        )}
      </div>

      <BudgetFormDialog
        open={formOpen}
        title={editing ? 'Edit Anggaran' : 'Tambah Anggaran'}
        categories={categories}
        initialValues={initialFormValues}
        submitting={submitting}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />
    </Page>
  );
}
