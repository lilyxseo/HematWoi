import clsx from 'clsx';
import type { BudgetWithActual } from '../../../lib/budgetsApi';
import { formatCurrency } from '../../../lib/format.js';
import {
  EyeIcon,
  PencilIcon,
  RefreshIcon,
  ToggleIcon,
} from '../../../components/budgets/InlineIcons';

interface BudgetCardProps {
  budget: BudgetWithActual;
  onViewTransactions: (budget: BudgetWithActual) => void;
  onEdit: (budget: BudgetWithActual) => void;
  onToggleCarryover: (budget: BudgetWithActual, nextValue: boolean) => void;
  onRollover?: (budget: BudgetWithActual) => void;
  rolloverEnabled?: boolean;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

function getStatus(progress: number, planned: number) {
  if (planned <= 0) {
    return {
      label: 'Belum disetel',
      className: 'bg-slate-700/60 text-slate-200',
      bar: 'bg-slate-600',
    };
  }
  if (progress > 1) {
    return {
      label: 'Over',
      className: 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40',
      bar: 'bg-rose-500/90',
    };
  }
  if (progress >= 0.9) {
    return {
      label: '90%+',
      className: 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40',
      bar: 'bg-orange-500/80',
    };
  }
  if (progress >= 0.75) {
    return {
      label: '75%+',
      className: 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40',
      bar: 'bg-amber-400/80',
    };
  }
  return {
    label: 'Aman',
    className: 'bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/30',
    bar: 'bg-[var(--accent)]',
  };
}

function getTypeChip(type: string | undefined) {
  if (type === 'income') {
    return 'bg-emerald-500/15 text-emerald-200';
  }
  return 'bg-rose-500/15 text-rose-200';
}

export default function BudgetCard({
  budget,
  onEdit,
  onViewTransactions,
  onToggleCarryover,
  onRollover,
  rolloverEnabled = true,
}: BudgetCardProps) {
  const planned = Number(budget.planned ?? budget.amount_planned ?? 0);
  const actual = Number(budget.actual ?? 0);
  const remaining = planned - actual;
  const progress = planned > 0 ? actual / planned : actual > 0 ? 1 : 0;
  const status = getStatus(progress, planned);
  const width = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  const percentLabel = planned > 0 ? formatPercent(progress) : '0%';
  const remainingLabel = formatCurrency(Math.abs(remaining), 'IDR');
  const remainingNegative = remaining < 0;

  const canRollover = typeof onRollover === 'function';
  const rolloverDisabled = !canRollover || !rolloverEnabled;

  return (
    <article className="relative flex flex-col gap-4 rounded-2xl bg-slate-900/90 p-4 ring-1 ring-slate-800 transition hover:ring-slate-700 focus-within:ring-[var(--accent)]/60">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-100" title={budget.category?.name ?? 'Tanpa kategori'}>
              {budget.category?.name ?? 'Tanpa kategori'}
            </h3>
            <span
              className={clsx(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
                getTypeChip(budget.category?.type)
              )}
            >
              {budget.category?.type === 'income' ? 'Income' : 'Expense'}
            </span>
          </div>
          {budget.category?.group_name ? (
            <p className="text-xs text-slate-400">{budget.category.group_name}</p>
          ) : null}
        </div>
        <span className={clsx('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide', status.className)}>
          {status.label}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm text-slate-200 sm:grid-cols-3">
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Planned</dt>
          <dd className="font-mono text-sm text-slate-100">
            {planned > 0 ? formatCurrency(planned, 'IDR') : <span className="text-slate-500">Belum disetel</span>}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Actual MTD</dt>
          <dd className="font-mono text-sm text-slate-100">{formatCurrency(actual, 'IDR')}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Remaining</dt>
          <dd
            className={clsx(
              'font-mono text-sm',
              remainingNegative ? 'text-rose-300' : 'text-emerald-300'
            )}
          >
            {remainingNegative ? `- ${remainingLabel}` : remainingLabel}
          </dd>
        </div>
      </dl>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Progress</span>
          <span className="font-mono text-slate-200">{percentLabel}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className={clsx('h-full rounded-full transition-all duration-300', status.bar)} style={{ width }} />
        </div>
        {progress > 1 ? (
          <p className="text-xs text-rose-300">Pengeluaran melebihi anggaran sebesar {formatCurrency(actual - planned, 'IDR')}.</p>
        ) : null}
        {budget.carryover_enabled ? (
          <p className="text-xs text-slate-400">Carryover aktif untuk kategori ini.</p>
        ) : null}
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
          <span>Bulan</span>
          <span className="font-mono text-slate-300">{budget.period_month?.slice(0, 7)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Lihat transaksi"
            aria-label="Lihat transaksi"
            onClick={() => onViewTransactions(budget)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          >
            <EyeIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Edit anggaran"
            aria-label="Edit anggaran"
            onClick={() => onEdit(budget)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-slate-200 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            title={budget.carryover_enabled ? 'Nonaktifkan carryover' : 'Aktifkan carryover'}
            aria-label={budget.carryover_enabled ? 'Nonaktifkan carryover' : 'Aktifkan carryover'}
            onClick={() => onToggleCarryover(budget, !budget.carryover_enabled)}
            className={clsx(
              'flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
              budget.carryover_enabled
                ? 'bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30'
                : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
            )}
          >
            <ToggleIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            title="Rollover ke bulan berikutnya"
            aria-label="Rollover ke bulan berikutnya"
            disabled={rolloverDisabled}
            onClick={() => onRollover?.(budget)}
            className={clsx(
              'flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60',
              rolloverDisabled
                ? 'cursor-not-allowed bg-slate-800/40 text-slate-600'
                : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
            )}
          >
            <RefreshIcon className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </article>
  );
}
