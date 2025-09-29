import type { BudgetWithActual } from '../../lib/budgetsApi';
import { formatCurrency } from '../../lib/format.js';
import { EyeIcon, PencilIcon, RefreshIcon, SwitchIcon } from './InlineIcons';

interface BudgetCardProps {
  budget: BudgetWithActual;
  disableActions?: boolean;
  onViewTransactions?: (budget: BudgetWithActual) => void;
  onEdit?: (budget: BudgetWithActual) => void;
  onToggleCarryover?: (budget: BudgetWithActual, carryover: boolean) => void;
  onRollover?: (budget: BudgetWithActual) => void;
}

interface StatusStyles {
  label: string;
  badgeClass: string;
  barClass: string;
}

function resolveStatus(budget: BudgetWithActual): StatusStyles {
  if (budget.planned <= 0) {
    return {
      label: 'Belum disetel',
      badgeClass: 'bg-slate-800 text-slate-300 ring-1 ring-slate-700',
      barClass: 'bg-slate-700',
    };
  }

  const percent = budget.percent;

  if (percent < 0.75) {
    return {
      label: 'Aman',
      badgeClass: 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/40',
      barClass: 'bg-[var(--accent)]',
    };
  }
  if (percent < 0.9) {
    return {
      label: '75%+',
      badgeClass: 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40',
      barClass: 'bg-amber-400/80',
    };
  }
  if (percent <= 1) {
    return {
      label: '90%+',
      badgeClass: 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40',
      barClass: 'bg-orange-500/80',
    };
  }
  return {
    label: 'Over',
    badgeClass: 'bg-rose-500/25 text-rose-100 ring-1 ring-rose-500/60',
    barClass: 'bg-rose-500/90',
  };
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || Number.isNaN(value)) return '0%';
  const capped = Math.floor(value * 1000) / 10;
  if (capped > 999) return '>999%';
  if (capped < 0) return '0%';
  return `${Math.round(capped)}%`;
}

function typeChipClass(type: string | undefined) {
  if (type === 'income') {
    return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40';
  }
  return 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/40';
}

export default function BudgetCard({
  budget,
  disableActions = false,
  onViewTransactions,
  onEdit,
  onToggleCarryover,
  onRollover,
}: BudgetCardProps) {
  const status = resolveStatus(budget);
  const percent = budget.planned > 0 ? Math.max(budget.percent, 0) : 0;
  const barWidth = budget.planned > 0 ? `${Math.min(percent, 1) * 100}%` : '0%';
  const remaining = Number(budget.remaining ?? 0);
  const remainingClass = remaining < 0 ? 'text-rose-300' : 'text-slate-100';
  const plannedLabel = budget.planned > 0 ? formatCurrency(budget.planned, 'IDR') : 'Belum disetel';
  const actualLabel = formatCurrency(budget.actual, 'IDR');
  const remainingLabel = formatCurrency(remaining, 'IDR');
  const percentLabel = budget.planned > 0 ? formatPercent(budget.percent) : '0%';
  const carryoverActive = Boolean(budget.carryover_enabled);

  return (
    <article className="relative flex h-full flex-col gap-4 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800 transition hover:ring-slate-700">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-100">
              {budget.category?.name ?? 'Tanpa kategori'}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${typeChipClass(
                budget.category?.type
              )}`}
            >
              {budget.category?.type === 'income' ? 'Income' : 'Expense'}
            </span>
          </div>
          {budget.category?.group_name ? (
            <p className="text-xs text-slate-400">{budget.category.group_name}</p>
          ) : null}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.badgeClass}`}>{status.label}</span>
      </header>

      <dl className="grid gap-2 text-xs text-slate-400">
        <div className="flex items-center justify-between gap-2">
          <dt>Planned</dt>
          <dd className={`font-mono text-sm ${budget.planned <= 0 ? 'text-amber-200' : 'text-slate-100'}`}>{plannedLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Actual MTD</dt>
          <dd className="font-mono text-sm text-slate-100">{actualLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt>Remaining</dt>
          <dd className="flex items-baseline gap-2 text-right">
            <span className={`font-mono text-sm ${remainingClass}`}>{remainingLabel}</span>
            <span className="text-xs text-slate-500">{percentLabel}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-1">
        <div className="h-2 rounded-full bg-slate-800">
          <div className={`h-full rounded-full ${status.barClass}`} style={{ width: barWidth }} />
        </div>
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 pt-2">
        {carryoverActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-300">
            <SwitchIcon className="h-3.5 w-3.5" aria-hidden /> Carryover aktif
          </span>
        ) : (
          <span className="text-[11px] text-slate-500">Carryover off</span>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
            onClick={() => onViewTransactions?.(budget)}
            disabled={disableActions}
            aria-label="Lihat transaksi"
            title="Lihat transaksi"
          >
            <EyeIcon className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 ${
              budget.planned <= 0 ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'text-slate-300 hover:bg-slate-800'
            }`}
            onClick={() => onEdit?.(budget)}
            disabled={disableActions}
            aria-label="Edit anggaran"
            title="Edit anggaran"
          >
            <PencilIcon className="h-5 w-5" aria-hidden />
          </button>
          {onToggleCarryover ? (
            <button
              type="button"
              className={`flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 ${
                carryoverActive ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-slate-300 hover:bg-slate-800'
              }`}
              onClick={() => onToggleCarryover(budget, !carryoverActive)}
              disabled={disableActions}
              aria-label="Toggle carryover"
              title="Toggle carryover"
            >
              <SwitchIcon className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          {onRollover ? (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
              onClick={() => onRollover(budget)}
              disabled={disableActions}
              aria-label="Rollover ke bulan berikutnya"
              title="Rollover ke bulan berikutnya"
            >
              <RefreshIcon className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
