import { formatBudgetAmount } from '../../lib/api-budgets';
import type { BudgetViewModel } from './types';

interface BudgetCardProps {
  budget: BudgetViewModel;
  onOpenDetail: () => void;
  onEdit: (field: 'planned' | 'rollover_in', value: number) => void;
  onRule: () => void;
  onDelete: () => void;
}

function statusLabel(status: BudgetViewModel['status']) {
  switch (status) {
    case 'overspend':
      return { label: 'Overspend', className: 'bg-red-500/10 text-red-500' };
    case 'warning':
      return { label: 'Mendekati batas', className: 'bg-amber-500/10 text-amber-600' };
    default:
      return { label: 'On track', className: 'bg-emerald-500/10 text-emerald-600' };
  }
}

function toNumber(value: string, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function BudgetCard({ budget, onOpenDetail, onEdit, onRule, onDelete }: BudgetCardProps) {
  const badge = statusLabel(budget.status);
  const progressPercent = Math.min(100, Math.round(budget.progress * 100));
  const progressColor =
    budget.status === 'overspend'
      ? 'bg-red-500'
      : budget.status === 'warning'
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-border/70 bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2 p-5 shadow-md transition-shadow hover:shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-lg font-semibold text-foreground">{budget.label}</p>
          <span
            className={`inline-flex items-center rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:border-border hover:bg-surface-2"
          onClick={onRule}
        >
          Atur aturan
        </button>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="flex flex-col rounded-2xl border border-border/60 bg-surface-1/80 p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Rencana</p>
          <input
            type="number"
            defaultValue={budget.planned.toFixed(2)}
            step="1000"
            className="mt-2 h-11 w-full rounded-2xl border border-border/70 bg-transparent px-3 text-right text-base font-semibold tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            onBlur={(event) => {
              const next = toNumber(event.target.value, budget.planned);
              if (next !== budget.planned) onEdit('planned', next);
            }}
          />
        </div>
        <div className="flex flex-col justify-center rounded-2xl border border-border/60 bg-surface-1/80 p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Aktual</p>
          <p className="mt-2 text-base font-semibold tabular-nums text-foreground">{formatBudgetAmount(budget.actual)}</p>
        </div>
        <div className="flex flex-col justify-center rounded-2xl border border-border/60 bg-surface-1/80 p-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Sisa</p>
          <p className={`mt-2 text-base font-semibold tabular-nums ${budget.remaining < 0 ? 'text-red-500' : 'text-foreground'}`}>
            {formatBudgetAmount(budget.remaining)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
          <span>Progress anggaran</span>
          <span className="tabular-nums text-foreground">{progressPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
          <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:w-auto sm:flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Carryover</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="number"
              defaultValue={budget.rolloverIn.toFixed(2)}
              step="1000"
              className="h-11 w-full rounded-2xl border border-border/70 bg-surface-1 px-3 text-right text-base font-semibold tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:max-w-[200px]"
              onBlur={(event) => {
                const next = toNumber(event.target.value, budget.rolloverIn);
                if (next !== budget.rolloverIn) onEdit('rollover_in', next);
              }}
            />
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                type="button"
                className="inline-flex items-center rounded-2xl border border-border/60 bg-surface-1 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-border hover:bg-surface-2"
                onClick={onOpenDetail}
              >
                Edit
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-500 shadow-sm transition hover:border-red-300 hover:bg-red-100"
                onClick={onDelete}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
