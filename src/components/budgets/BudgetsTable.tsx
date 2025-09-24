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
  rulesEnabled?: boolean;
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
  rulesEnabled = true,
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
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-3">
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="sticky top-0 px-4 py-3 text-left">Kategori / Envelope</th>
              <th scope="col" className="sticky top-0 px-4 py-3 text-right">Rencana</th>
              <th scope="col" className="sticky top-0 px-4 py-3 text-right">Rollover in</th>
              <th scope="col" className="sticky top-0 px-4 py-3 text-right">Aktual</th>
              <th scope="col" className="sticky top-0 px-4 py-3 text-right">Sisa</th>
              <th scope="col" className="sticky top-0 px-4 py-3">Aturan</th>
              <th scope="col" className="sticky top-0 px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !budgets.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  Memuat anggaran…
                </td>
              </tr>
            ) : budgets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  Belum ada anggaran untuk periode ini.
                </td>
              </tr>
            ) : (
              budgets.map((budget) => (
                <tr key={budget.id} className="bg-surface-1">
                  <td className="max-w-[260px] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(budget)}
                      className="flex w-full flex-col items-start text-left"
                    >
                      <span className="font-medium text-text">{budget.label}</span>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
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
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      defaultValue={budget.planned.toFixed(2)}
                      min={0}
                      step="1000"
                      className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-right text-sm tabular-nums"
                      onBlur={(event) => handleCommit(budget, 'planned', event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleCommit(budget, 'planned', (event.target as HTMLInputElement).value);
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      defaultValue={budget.rolloverIn.toFixed(2)}
                      step="1000"
                      className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-right text-sm tabular-nums"
                      onBlur={(event) => handleCommit(budget, 'rollover_in', event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleCommit(budget, 'rollover_in', (event.target as HTMLInputElement).value);
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatBudgetAmount(budget.actual)}
                      </p>
                      <div className="h-2 w-full rounded-full bg-border">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(budget.status)}`}
                          style={{ width: `${Math.min(100, Math.round(budget.progress * 100))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="space-y-1 text-sm tabular-nums">
                      <p className={budget.remaining < 0 ? 'text-red-500' : ''}>
                        {formatBudgetAmount(budget.remaining)}
                      </p>
                      {budget.coverageDays != null && (
                        <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                          Aman {budget.coverageDays} hari
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm"
                      value={budget.carryRule}
                      onChange={(event) => handleSelect(budget, event.target.value)}
                    >
                      <option value="none">Tidak dibawa</option>
                      <option value="carry-positive">Bawa sisa positif</option>
                      <option value="carry-all">Bawa semua</option>
                      <option value="reset-zero">Reset ke nol</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        className={`rounded-xl border border-border px-3 py-1 ${
                          rulesEnabled ? '' : 'cursor-not-allowed opacity-60'
                        }`}
                        onClick={() => {
                          if (!rulesEnabled) return;
                          onManageRule(budget);
                        }}
                        disabled={!rulesEnabled}
                        aria-disabled={!rulesEnabled}
                        title={
                          rulesEnabled
                            ? undefined
                            : 'Aturan anggaran belum tersedia di workspace ini'
                        }
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
