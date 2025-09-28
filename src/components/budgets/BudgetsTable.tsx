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
          {budgets.map((budget) => {
            const progress = Math.min(100, Math.round(budget.progress * 100));
            return (
              <div key={budget.id} className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(budget)}
                      className="text-left"
                    >
                      <p className="text-sm font-semibold text-text">{budget.label}</p>
                      <p className="text-xs text-muted">Klik untuk detail transaksi</p>
                    </button>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
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
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted">
                      <span>Progres</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-border">
                      <div className={`h-2 rounded-full ${getProgressColor(budget.status)}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <label className="space-y-1 text-left">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">Rencana</span>
                    <input
                      type="number"
                      defaultValue={budget.planned.toFixed(2)}
                      min={0}
                      step="1000"
                      className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-right text-sm tabular-nums text-text"
                      onBlur={(event) => handleCommit(budget, 'planned', event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleCommit(budget, 'planned', (event.target as HTMLInputElement).value);
                        }
                      }}
                    />
                  </label>
                  <label className="space-y-1 text-left">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">Rollover In</span>
                    <input
                      type="number"
                      defaultValue={budget.rolloverIn.toFixed(2)}
                      step="1000"
                      className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-right text-sm tabular-nums text-text"
                      onBlur={(event) => handleCommit(budget, 'rollover_in', event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleCommit(budget, 'rollover_in', (event.target as HTMLInputElement).value);
                        }
                      }}
                    />
                  </label>
                  <div className="space-y-1 text-left">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">Aktual</span>
                    <p className="text-sm font-semibold tabular-nums text-text">
                      {formatBudgetAmount(budget.actual)}
                    </p>
                  </div>
                  <div className="space-y-1 text-left">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">Sisa</span>
                    <p className={`text-sm font-semibold tabular-nums ${budget.remaining < 0 ? 'text-red-500' : 'text-text'}`}>
                      {formatBudgetAmount(budget.remaining)}
                    </p>
                    {budget.coverageDays != null && (
                      <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                        Aman {budget.coverageDays} hari
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 text-sm">
                  <label className="space-y-1 text-left">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">Aturan Rollover</span>
                    <select
                      className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text"
                      value={budget.carryRule}
                      onChange={(event) => handleSelect(budget, event.target.value)}
                    >
                      <option value="none">Tidak dibawa</option>
                      <option value="carry-positive">Bawa sisa positif</option>
                      <option value="carry-all">Bawa semua</option>
                      <option value="reset-zero">Reset ke nol</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2 text-xs">
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
