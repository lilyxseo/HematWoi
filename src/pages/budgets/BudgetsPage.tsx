import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Page from '../../layout/Page';
import { useToast } from '../../context/ToastContext';
import {
  useBudgetCategories,
  useBudgetMutations,
  useBudgets,
} from '../../hooks/useBudgets';
import BudgetCard from '../../components/budgets/BudgetCard';
import BudgetFilters from '../../components/budgets/BudgetFilters';
import BudgetFormDialog, { type BudgetFormValues } from '../../components/budgets/BudgetFormDialog';
import { PlusIcon, RefreshIcon } from '../../components/budgets/InlineIcons';
import {
  getPeriodBounds,
  type BudgetTypeFilter,
  type BudgetWithActual,
} from '../../lib/budgetsApi';
import { formatCurrency } from '../../lib/format.js';

function getCurrentPeriod(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

interface GroupedEntry {
  label: string;
  items: BudgetWithActual[];
}

function groupBudgets(budgets: BudgetWithActual[], grouped: boolean): GroupedEntry[] {
  if (!grouped) {
    return [{ label: 'all', items: budgets }];
  }
  const map = new Map<string, BudgetWithActual[]>();
  for (const budget of budgets) {
    const key = budget.category?.group_name?.trim() || 'Tanpa grup';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(budget);
  }
  return Array.from(map.entries())
    .map(([label, items]) => ({ label, items }))
    .sort((a, b) => a.label.localeCompare(b.label, 'id-ID'));
}

function BudgetSkeletonCard() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded-full bg-slate-800" />
          <div className="h-3 w-20 animate-pulse rounded-full bg-slate-800" />
        </div>
        <div className="h-6 w-20 animate-pulse rounded-full bg-slate-800" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-800" />
        <div className="h-3 w-11/12 animate-pulse rounded-full bg-slate-800" />
        <div className="h-3 w-10/12 animate-pulse rounded-full bg-slate-800" />
      </div>
      <div className="h-2 w-full animate-pulse rounded-full bg-slate-800" />
      <div className="flex justify-end gap-2">
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-800" />
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-800" />
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-800" />
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}

export default function BudgetsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithActual | null>(null);

  const periodParam = searchParams.get('period');
  const searchParam = searchParams.get('q') ?? '';
  const typeParam = (searchParams.get('type') as BudgetTypeFilter | null) ?? 'expense';
  const grouped = searchParams.get('group') === '1';

  const period = periodParam && /^\d{4}-\d{2}$/.test(periodParam) ? periodParam : getCurrentPeriod();

  const { budgets, summary, isLoading, isFetching, error, refetch } = useBudgets({ period });
  const { categories, isLoading: categoriesLoading } = useBudgetCategories('all');
  const { createMutation, updateMutation } = useBudgetMutations(period);

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const normalizedSearch = searchParam.trim().toLowerCase();

  const filteredBudgets = useMemo(() => {
    const sorted = [...budgets].sort((a, b) => {
      const nameA = a.category?.name ?? '';
      const nameB = b.category?.name ?? '';
      return nameA.localeCompare(nameB, 'id-ID');
    });

    return sorted.filter((budget) => {
      const matchesType =
        typeParam === 'all' ? true : (budget.category?.type ?? 'expense') === typeParam;
      if (!matchesType) return false;
      if (!normalizedSearch) return true;
      const name = (budget.category?.name ?? '').toLowerCase();
      const group = (budget.category?.group_name ?? '').toLowerCase();
      return name.includes(normalizedSearch) || group.includes(normalizedSearch);
    });
  }, [budgets, typeParam, normalizedSearch]);

  const groupedBudgets = useMemo(() => groupBudgets(filteredBudgets, grouped), [filteredBudgets, grouped]);

  const handleUpdateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setSearchParams(next, { replace: true });
  };

  const handleOpenCreate = () => {
    setDialogMode('create');
    setSelectedBudget(null);
    setDialogOpen(true);
  };

  const handleEdit = (budget: BudgetWithActual) => {
    setDialogMode('edit');
    setSelectedBudget(budget);
    setDialogOpen(true);
  };

  const handleViewTransactions = (budget: BudgetWithActual) => {
    if (!budget.category_id) {
      addToast('Kategori tidak tersedia untuk transaksi ini', 'info');
      return;
    }
    const { start, end } = getPeriodBounds(period);
    navigate(`/transactions?category=${budget.category_id}&start=${start}&end=${end}`);
  };

  const handleToggleCarryover = async (budget: BudgetWithActual, carryover: boolean) => {
    try {
      await updateMutation.mutateAsync({ id: budget.id, carryover_enabled: carryover });
      addToast('Carryover diperbarui', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memperbarui carryover';
      addToast(message, 'error');
    }
  };

  const handleRollover = (budget: BudgetWithActual) => {
    const remaining = Math.max(0, budget.remaining);
    const info =
      remaining > 0
        ? `Sisa ${formatCurrency(remaining, 'IDR')} siap dialihkan ke bulan berikutnya.`
        : 'Tidak ada sisa anggaran untuk di-rollover bulan ini.';
    addToast(`${info} Hubungi admin untuk mengaktifkan fitur rollover otomatis.`, 'info');
  };

  const handleSubmit = async (values: BudgetFormValues) => {
    const payload = {
      period: values.period,
      category_id: values.category_id || null,
      planned: Number(values.planned) || 0,
      carryover_enabled: values.carryover_enabled,
      notes: values.notes.trim() || null,
    };

    try {
      if (dialogMode === 'create') {
        await createMutation.mutateAsync(payload);
        addToast('Anggaran ditambahkan', 'success');
      } else if (selectedBudget) {
        await updateMutation.mutateAsync({ id: selectedBudget.id, ...payload });
        addToast('Anggaran diperbarui', 'success');
      }
      setDialogOpen(false);
      setSelectedBudget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan anggaran';
      addToast(message, 'error');
      throw err;
    }
  };

  const defaultFormValues: BudgetFormValues = useMemo(
    () => ({
      period,
      category_id: '',
      planned: '',
      carryover_enabled: false,
      notes: '',
    }),
    [period]
  );

  const dialogInitialValues: BudgetFormValues = useMemo(() => {
    if (!selectedBudget) return defaultFormValues;
    return {
      period: selectedBudget.period_month?.slice(0, 7) ?? period,
      category_id: selectedBudget.category_id ?? '',
      planned: selectedBudget.planned > 0 ? String(selectedBudget.planned) : '',
      carryover_enabled: Boolean(selectedBudget.carryover_enabled),
      notes: selectedBudget.notes ?? '',
    };
  }, [defaultFormValues, selectedBudget, period]);

  const showSkeleton = isLoading && budgets.length === 0;
  const showEmpty = !isLoading && filteredBudgets.length === 0;

  return (
    <Page>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-100">Anggaran Bulan Ini</h1>
            <p className="text-sm text-slate-400">
              Pantau alokasi dan realisasi setiap kategori untuk menjaga pengeluaranmu tetap aman.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => addToast('Rollover otomatis belum diaktifkan untuk akun ini.', 'info')}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            >
              <RefreshIcon className="h-4 w-4" aria-hidden />
              Rollover Otomatis
            </button>
            <button
              type="button"
              onClick={handleOpenCreate}
              disabled={categoriesLoading}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 shadow transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
              Tambah Anggaran
            </button>
          </div>
        </header>

        <BudgetFilters
          period={period}
          search={searchParam}
          type={typeParam}
          grouped={grouped}
          onPeriodChange={(value) => handleUpdateParams({ period: value || null })}
          onSearchChange={(value) => handleUpdateParams({ q: value || null })}
          onTypeChange={(value) => handleUpdateParams({ type: value === 'expense' ? null : value })}
          onGroupToggle={(value) => handleUpdateParams({ group: value ? '1' : null })}
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryStat label="Total Planned" value={formatCurrency(summary.planned, 'IDR')} />
          <SummaryStat label="Actual MTD" value={formatCurrency(summary.actual, 'IDR')} />
          <SummaryStat label="Remaining" value={formatCurrency(summary.remaining, 'IDR')} />
          <SummaryStat label="Progress" value={`${Math.round(Math.min(summary.progress, 1) * 100)}%`} />
        </section>

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/30">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex h-9 items-center justify-center rounded-full border border-red-500/40 px-3 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
            >
              Coba lagi
            </button>
          </div>
        ) : null}

        {showSkeleton ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <BudgetSkeletonCard key={index} />
            ))}
          </div>
        ) : showEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-slate-900/70 px-6 py-16 text-center ring-1 ring-slate-800">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80 text-[var(--accent)]">
              <PlusIcon className="h-7 w-7" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Belum ada anggaran untuk filter ini</h2>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Tambahkan anggaran baru atau ubah filter pencarian untuk melihat kategori lainnya.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-slate-950 shadow transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
              Tambah Anggaran
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedBudgets.map(({ label, items }) => (
              <section key={label} className="space-y-3">
                {grouped ? (
                  <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-400">{label}</h2>
                ) : null}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((budget) => (
                    <BudgetCard
                      key={budget.id}
                      budget={budget}
                      disableActions={isMutating || isFetching}
                      onViewTransactions={handleViewTransactions}
                      onEdit={handleEdit}
                      onToggleCarryover={handleToggleCarryover}
                      onRollover={handleRollover}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <BudgetFormDialog
        open={dialogOpen}
        mode={dialogMode}
        categories={categories}
        initialValues={dialogInitialValues}
        submitting={isMutating}
        onClose={() => {
          setDialogOpen(false);
          setSelectedBudget(null);
        }}
        onSubmit={handleSubmit}
      />
    </Page>
  );
}
