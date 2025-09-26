import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatIDR } from '../lib/format';
import { firstDayOfThisMonthISO } from '../lib/date';

type BudgetRow = {
  planned: number | string | null;
  rollover_in: number | string | null;
  current_spent: number | string | null;
};

type BudgetSummary = {
  effectiveBudget: number;
  totalSpent: number;
  remaining: number;
  usedPct: number;
  hasRows: boolean;
};

const toNumber = (value: number | string | null): number => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const summarizeBudgets = (rows: BudgetRow[]): BudgetSummary => {
  const safeRows = Array.isArray(rows) ? rows : [];

  let effectiveBudget = 0;
  let totalSpent = 0;

  for (const row of safeRows) {
    const planned = toNumber(row.planned);
    const rolloverIn = toNumber(row.rollover_in);
    const spent = toNumber(row.current_spent);

    effectiveBudget += planned + rolloverIn;
    totalSpent += spent;
  }

  const remaining = Math.max(effectiveBudget - totalSpent, 0);
  const usedPct = effectiveBudget > 0 ? clamp((totalSpent / effectiveBudget) * 100, 0, 100) : 0;

  return {
    effectiveBudget,
    totalSpent,
    remaining,
    usedPct,
    hasRows: safeRows.length > 0,
  };
};

export function BudgetProgressWidget(): JSX.Element {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState<boolean>(false);

  useEffect(() => {
    const animationFrame = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBudgets = async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('budgets')
        .select('planned, rollover_in, current_spent')
        .eq('period_month', firstDayOfThisMonthISO());

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message ?? 'Gagal memuat');
        setRows([]);
      } else {
        setRows(data ?? []);
      }

      setLoading(false);
    };

    void loadBudgets();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => summarizeBudgets(rows), [rows]);
  const { effectiveBudget, totalSpent, remaining, usedPct, hasRows } = summary;

  const progressColor = useMemo(() => {
    if (usedPct > 90) return '#ef4444';
    if (usedPct >= 70) return '#f59e0b';
    return '#3898f8';
  }, [usedPct]);

  const size = 176;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (circumference * usedPct) / 100;
  const roundedPct = Math.round(usedPct);
  const showEmptyState = !loading && !error && (!hasRows || effectiveBudget <= 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="h-4 w-32 rounded-full bg-slate-200/80" />
        <div className="mt-8 flex flex-col items-center gap-6">
          <div className="h-40 w-40 rounded-full bg-slate-200/70" />
          <div className="grid w-full grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div className="h-4 rounded-full bg-slate-200/80 sm:col-span-1" />
            <div className="h-4 rounded-full bg-slate-200/80 sm:col-span-1" />
            <div className="h-4 rounded-full bg-slate-200/80 sm:col-span-1" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-red-100 bg-white p-4 shadow-sm sm:p-6">
        <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600">
          Gagal memuat
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition duration-200 ease-out sm:p-6 ${
        animateIn ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}
    >
      <div className="text-sm font-medium text-slate-500">Progress Anggaran</div>
      <div
        className="group relative mx-auto mt-6 flex h-48 w-48 items-center justify-center"
        role="img"
        aria-label={`Progress anggaran ${roundedPct} persen`}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={progressColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 600ms ease' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center text-center">
          <span className="text-4xl font-bold tracking-tight text-slate-800">{roundedPct}%</span>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">terpakai</span>
        </div>
        <div className="pointer-events-none absolute -bottom-4 left-1/2 w-max -translate-x-1/2 translate-y-2 rounded-xl bg-slate-900/90 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-y-0 group-hover:opacity-100">
          <div>Budget: {formatIDR(effectiveBudget)}</div>
          <div>Spent: {formatIDR(totalSpent)}</div>
          <div>Sisa: {formatIDR(remaining)}</div>
        </div>
      </div>
      {showEmptyState && (
        <p className="mt-4 text-center text-sm font-medium text-slate-500">Belum ada anggaran bulan ini</p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div className="flex flex-col items-start justify-center text-left sm:items-center sm:text-center">
          <span className="text-xs uppercase tracking-wide text-slate-500">Budget</span>
          <span className="mt-1 text-base font-semibold text-slate-800">{formatIDR(effectiveBudget)}</span>
        </div>
        <div className="flex flex-col items-start justify-center text-left sm:items-center sm:text-center">
          <span className="text-xs uppercase tracking-wide text-slate-500">Spent</span>
          <span className="mt-1 text-base font-semibold text-slate-800">{formatIDR(totalSpent)}</span>
        </div>
        <div className="col-span-2 flex flex-col items-start justify-center text-left sm:col-span-1 sm:items-center sm:text-center">
          <span className="text-xs uppercase tracking-wide text-slate-500">Sisa</span>
          <span className="mt-1 text-base font-semibold text-slate-800">{formatIDR(remaining)}</span>
        </div>
      </div>
    </div>
  );
}

export default BudgetProgressWidget;
