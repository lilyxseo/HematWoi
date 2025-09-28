import type { CarryRule } from '../../lib/api-budgets';
import { formatBudgetAmount } from '../../lib/api-budgets';
import type { BudgetViewModel } from './types';

interface BudgetsTableProps {
  budgets: BudgetViewModel[];
  loading?: boolean;
  onInlineUpdate: (
    id: string,
    payload: { planned?: number; rollover_in?: number; carry_rule?: CarryRule }
  ) => void;
  onOpenDetail: (budget: BudgetViewModel) => void;
  onDelete: (id: string) => void;
  onManageRule: (budget: BudgetViewModel) => void;
  onComputeRollover: () => void;
  onApplyRollover: () => void;
}

function getProgressColor(status: BudgetViewModel['status']) {
  switch (status) {
    case 'overspend':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-emerald-500';
  }
}

function toNumber(value: string, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function BudgetsTable({
  budgets,
  loading,
  onInlineUpdate,
  onOpenDetail,
  onDelete,
  onManageRule,
  onComputeRollover,
  onApplyRollover,
}: BudgetsTableProps) {
  const handleCommit = (
    budget: BudgetViewModel,
    field: 'planned' | 'rollover_in',
    value: string
  ) => {
    const base = field === 'planned' ? budget.planned : budget.rolloverIn;
    const next = toNumber(value, base);
    if (next === base) return;
    const payload = field === 'planned' ? { planned: next } : { rollover_in: next };
    onInlineUpdate(budget.id, payload);
  };

  const handleSelect = (budget: BudgetViewModel, value: string) => {
    const carry = value as CarryRule;
    if (carry === budget.carryRule) return;
    onInlineUpdate(budget.id, { carry_rule: carry });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-col gap-3 border-b border-border bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">Daftar Anggaran</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            className="rounded-xl border border-border px-3 py-1"
            onClick={onComputeRollover}
          >
            Hitung Rollover
          </button>
          <button
            type="button"
            className="rounded-xl border border-border px-3 py-1"
            onClick={onApplyRollover}
          >
            Terapkan ke Bulan Berikut
          </button>
        </div>
      </div>
      {loading && !budgets.length ? (
        <div className="px-4 py-8 text-center text-sm text-muted">Memuat anggaran…</div>
      ) : budgets.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted">
          Belum ada anggaran untuk periode ini.
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => (
            <div key={budget.id} className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onOpenDetail(budget)}
                  className="text-left"
                >
                  <span className="block text-base font-semibold text-text">{budget.label}</span>
                  <span
                    className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      budget.status === 'overspend'
                        ? 'bg-red-500/10 text-red-500'
                        : budget.status === 'warning'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-emerald-500/10 text-emerald-600'
                    }`}
                  >
                    {budget.status === 'overspend'
                      ? 'Overspend'
                      : budget.status === 'warning'
                      ? 'Mendekati batas'
                      : 'On track'}
                  </span>
                </button>
                <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                  <button
                    type="button"
                    className="rounded-xl border border-border px-3 py-1"
                    onClick={() => onManageRule(budget)}
                  >
                    Atur Aturan
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-border px-3 py-1"
                    onClick={() => onOpenDetail(budget)}
                  >
                    Detail
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-border px-3 py-1 text-red-500"
                    onClick={() => onDelete(budget.id)}
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted">Rencana</span>
                  <input
                    type="number"
                    defaultValue={budget.planned.toFixed(2)}
                    min={0}
                    step="1000"
                    className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-right tabular-nums"
                    onBlur={(event) => handleCommit(budget, 'planned', event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        handleCommit(budget, 'planned', (event.target as HTMLInputElement).value);
                      }
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted">Rollover in</span>
                  <input
                    type="number"
                    defaultValue={budget.rolloverIn.toFixed(2)}
                    step="1000"
                    className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-right tabular-nums"
                    onBlur={(event) => handleCommit(budget, 'rollover_in', event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        handleCommit(budget, 'rollover_in', (event.target as HTMLInputElement).value);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Aktual</span>
                  <span className="tabular-nums">{formatBudgetAmount(budget.actual)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-border">
                  <div
                    className={`h-2 rounded-full ${getProgressColor(budget.status)}`}
                    style={{ width: `${Math.min(100, Math.round(budget.progress * 100))}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm tabular-nums">
                <div>
                  <p className={budget.remaining < 0 ? 'text-red-500' : ''}>
                    Sisa {formatBudgetAmount(budget.remaining)}
                  </p>
                  {budget.coverageDays != null && (
                    <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                      Aman {budget.coverageDays} hari
                    </span>
                  )}
                </div>
                <label className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-[180px]">
                  <span className="text-xs uppercase tracking-wide text-muted">Aturan rollover</span>
                  <select
                    className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
                    value={budget.carryRule}
                    onChange={(event) => handleSelect(budget, event.target.value)}
                  >
                    <option value="none">Tidak dibawa</option>
                    <option value="carry-positive">Bawa sisa positif</option>
                    <option value="carry-all">Bawa semua</option>
                    <option value="reset-zero">Reset ke nol</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
