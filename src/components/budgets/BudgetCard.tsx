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

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{budget.label}</p>
          <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <button
          type="button"
          className="rounded-2xl border border-border px-3 py-1 text-sm"
          onClick={onOpenDetail}
        >
          Detail
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted">Rencana</p>
          <input
            type="number"
            defaultValue={budget.planned.toFixed(2)}
            step="1000"
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-right tabular-nums"
            onBlur={(event) => {
              const next = toNumber(event.target.value, budget.planned);
              if (next !== budget.planned) onEdit('planned', next);
            }}
          />
        </div>
        <div>
          <p className="text-xs text-muted">Aktual</p>
          <p className="mt-2 text-sm font-semibold tabular-nums">{formatBudgetAmount(budget.actual)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Rollover in</p>
          <input
            type="number"
            defaultValue={budget.rolloverIn.toFixed(2)}
            step="1000"
            className="mt-1 h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-right tabular-nums"
            onBlur={(event) => {
              const next = toNumber(event.target.value, budget.rolloverIn);
              if (next !== budget.rolloverIn) onEdit('rollover_in', next);
            }}
          />
        </div>
        <div>
          <p className="text-xs text-muted">Sisa</p>
          <p className={`mt-2 text-sm font-semibold tabular-nums ${budget.remaining < 0 ? 'text-red-500' : ''}`}>
            {formatBudgetAmount(budget.remaining)}
          </p>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-border">
        <div
          className={`h-2 rounded-full ${
            budget.status === 'overspend'
              ? 'bg-red-500'
              : budget.status === 'warning'
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, Math.round(budget.progress * 100))}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <button
          type="button"
          className="rounded-2xl border border-border px-3 py-2"
          onClick={onRule}
        >
          Aturan
        </button>
        <button
          type="button"
          className="rounded-2xl border border-border px-3 py-2"
          onClick={onOpenDetail}
        >
          Detail
        </button>
        <button
          type="button"
          className="rounded-2xl border border-border px-3 py-2 text-red-500"
          onClick={onDelete}
        >
          Hapus
        </button>
      </div>
    </div>
  );
}
