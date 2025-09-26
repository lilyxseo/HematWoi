import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';

import { formatCurrency } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { useDataMode, useRepo } from '../../context/DataContext';

interface BudgetRecordLike {
  id?: string | number;
  period_month?: string | null;
  month?: string | null;
  planned?: number | string | null;
  amount_planned?: number | string | null;
  rollover_in?: number | string | null;
  current_spent?: number | string | null;
  name?: string | null;
  label?: string | null;
  category_key?: string | null;
  category?: string | null;
}

interface BudgetSummaryState {
  loading: boolean;
  error: string | null;
  records: BudgetRecordLike[];
}

function startOfCurrentMonthISO(): string {
  const now = new Date();
  const iso = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
  return iso.slice(0, 10);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value == null) return 0;
  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : 0;
}

function resolveCategoryLabel(record: BudgetRecordLike): string {
  return (
    record.label ||
    record.name ||
    record.category ||
    record.category_key ||
    'Tanpa kategori'
  );
}

function getProgressTone(pct: number): string {
  if (pct >= 0.9) return 'bg-rose-500';
  if (pct >= 0.7) return 'bg-amber-400';
  return 'bg-emerald-500';
}

export default function BudgetWidget() {
  const repo = useRepo();
  const { mode } = useDataMode();
  const [state, setState] = useState<BudgetSummaryState>({
    loading: true,
    error: null,
    records: [],
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const period = startOfCurrentMonthISO();

      try {
        let records: BudgetRecordLike[] = [];

        if (mode === 'local') {
          const list = await repo.budgets.list();
          records = Array.isArray(list) ? list : [];
        } else {
          const { data: userResult } = await supabase.auth.getUser();
          const userId = userResult.user?.id ?? null;
          let query = supabase
            .from('budgets')
            .select(
              'id, period_month, amount_planned, planned, rollover_in, current_spent, name, label, category_key'
            )
            .eq('period_month', period);
          if (userId) {
            query = query.eq('user_id', userId);
          }
          const { data, error } = await query;
          if (error) throw error;
          records = data ?? [];
        }

        const filtered = (records || []).filter((record) => {
          const monthValue = record.period_month ?? record.month ?? null;
          if (!monthValue) return false;
          const raw = String(monthValue);
          if (!raw) return false;
          if (raw.length >= 10) {
            return raw.slice(0, 10) === period;
          }
          if (raw.length >= 7) {
            return `${raw.slice(0, 7)}-01` === period;
          }
          const normalized = new Date(raw);
          return !Number.isNaN(normalized.getTime()) && normalized.toISOString().slice(0, 10) === period;
        });

        if (!active) return;
        setState({ loading: false, error: null, records: filtered });
      } catch (error) {
        console.error('[BudgetWidget] load failed', error);
        if (!active) return;
        setState({
          loading: false,
          error:
            error instanceof Error && error.message
              ? error.message
              : 'Gagal memuat data anggaran.',
          records: [],
        });
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [mode, repo]);

  const periodLabel = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const summary = useMemo(() => {
    const totals = state.records.reduce(
      (acc, record) => {
        const planned = toNumber(record.planned ?? record.amount_planned);
        const rollover = toNumber(record.rollover_in);
        const spent = toNumber(record.current_spent);
        acc.totalBudget += planned + rollover;
        acc.totalSpent += spent;
        return acc;
      },
      { totalBudget: 0, totalSpent: 0 }
    );

    const remaining = totals.totalBudget - totals.totalSpent;
    const utilization = totals.totalBudget > 0
      ? totals.totalSpent / totals.totalBudget
      : totals.totalSpent > 0
      ? 1
      : 0;

    const categories = state.records
      .map((record) => {
        const planned = toNumber(record.planned ?? record.amount_planned);
        const rollover = toNumber(record.rollover_in);
        const totalPlan = planned + rollover;
        const spent = toNumber(record.current_spent);
        const pct = totalPlan > 0 ? Math.min(spent / totalPlan, 1) : spent > 0 ? 1 : 0;
        return {
          id: record.id ?? resolveCategoryLabel(record),
          label: resolveCategoryLabel(record),
          planned: totalPlan,
          spent,
          pct,
          sortValue: Math.max(totalPlan, spent),
        };
      })
      .filter((item) => item.planned > 0 || item.spent > 0)
      .sort((a, b) => b.sortValue - a.sortValue)
      .slice(0, 3);

    return {
      totalBudget: totals.totalBudget,
      totalSpent: totals.totalSpent,
      remaining,
      utilization,
      categories,
    };
  }, [state.records]);

  const progressPercent = Math.min(Math.max(summary.utilization * 100, 0), 100);
  const progressTone = getProgressTone(summary.utilization);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface shadow-sm">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Anggaran {periodLabel}
            </p>
            <h2 className="mt-1 text-xl font-bold text-text">Ringkasan Bulan Ini</h2>
          </div>
        </div>

        {state.loading ? (
          <div className="mt-6 space-y-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-32 rounded-full bg-border/60" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <div className="h-8 w-40 rounded-full bg-border/50" />
                <div className="h-8 w-40 rounded-full bg-border/50" />
                <div className="h-8 w-40 rounded-full bg-border/50" />
              </div>
              <div className="h-2 w-full rounded-full bg-border/50" />
            </div>
            <div className="space-y-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className="animate-pulse space-y-2">
                  <div className="h-4 w-48 rounded-full bg-border/50" />
                  <div className="h-2 w-full rounded-full bg-border/40" />
                </div>
              ))}
            </div>
          </div>
        ) : state.error ? (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Gagal memuat data anggaran: {state.error}
          </div>
        ) : state.records.length === 0 ? (
          <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-border-subtle/60 bg-surface-alt p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-semibold text-text">Belum ada anggaran untuk bulan ini.</h3>
              <p className="mt-1 text-sm text-muted">
                Buat anggaran untuk mulai memantau pengeluaranmu.
              </p>
            </div>
            <Link
              to="/budgets"
              className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90"
            >
              Buat Anggaran
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Total Anggaran</p>
                  <p className="mt-1 text-lg font-semibold text-text">
                    {formatCurrency(summary.totalBudget, 'IDR')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Total Pengeluaran</p>
                  <p className="mt-1 text-lg font-semibold text-text">
                    {formatCurrency(summary.totalSpent, 'IDR')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Sisa Anggaran</p>
                  <p
                    className={clsx(
                      'mt-1 text-lg font-semibold',
                      summary.remaining < 0 ? 'text-rose-500' : 'text-text'
                    )}
                  >
                    {formatCurrency(summary.remaining, 'IDR')}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-muted">
                  <span>Progress penggunaan</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/50">
                  <div
                    className={clsx('h-full rounded-full transition-all', progressTone)}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {summary.categories.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-text">Kategori Teratas</p>
                <div className="mt-4 space-y-4">
                  {summary.categories.map((category) => (
                    <div key={category.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-text">{category.label}</span>
                        <span className="tabular-nums text-xs text-muted">
                          {formatCurrency(category.spent, 'IDR')} / {formatCurrency(category.planned, 'IDR')}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
                        <div
                          className={clsx('h-full rounded-full', getProgressTone(category.pct))}
                          style={{ width: `${Math.min(category.pct * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
