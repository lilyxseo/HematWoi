import { useMemo } from 'react';
import type { BaselineData, SimulationResult } from '../../../../lib/simScenarioApi';

interface DraftItemsMap {
  [categoryId: string]: {
    deltaMonthly: number;
    deltaWeekly: Record<string, number>;
  };
}

interface BudgetSimulationEditorProps {
  loading: boolean;
  baseline: BaselineData | null;
  draftItems: DraftItemsMap;
  lockedCategoryIds: Set<string>;
  mode: 'monthly' | 'weekly';
  useWeeklyBudgets: boolean;
  onChange: (categoryId: string, delta: { monthly?: number; weekly?: Record<string, number> }) => void;
  onToggleLock: (categoryId: string) => void;
  simulation: SimulationResult | null;
}

const numberFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return numberFormatter.format(Math.round(value ?? 0));
}

function getDraftValue(draftItems: DraftItemsMap, categoryId: string): { monthly: number; weekly: Record<string, number> } {
  const entry = draftItems[categoryId];
  return {
    monthly: entry?.deltaMonthly ?? 0,
    weekly: entry?.deltaWeekly ?? {},
  };
}

function ensureWeeklyDelta(
  draftItems: DraftItemsMap,
  categoryId: string,
  weeks: BaselineData['weeks']
): Record<string, number> {
  const draft = draftItems[categoryId]?.deltaWeekly ?? {};
  const normalized: Record<string, number> = {};
  for (const week of weeks ?? []) {
    normalized[week.start] = draft[week.start] ?? 0;
  }
  for (const [key, value] of Object.entries(draft)) {
    if (!(key in normalized)) {
      normalized[key] = value;
    }
  }
  return normalized;
}

export default function BudgetSimulationEditor({
  loading,
  baseline,
  draftItems,
  lockedCategoryIds,
  mode,
  useWeeklyBudgets,
  onChange,
  onToggleLock,
  simulation,
}: BudgetSimulationEditorProps): JSX.Element {
  const categories = baseline?.categories ?? [];
  const weeklyStructure = baseline?.weeks ?? [];
  const simulationMap = useMemo(() => {
    type SimulationCategory = SimulationResult['categories'][number];
    const map = new Map<string, SimulationCategory>();
    if (simulation) {
      for (const category of simulation.categories) {
        map.set(category.categoryId, category);
      }
    }
    return map;
  }, [simulation]);

  if (loading) {
    return (
      <div className="space-y-3 p-6" aria-busy="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-2xl bg-border/40" />
        ))}
      </div>
    );
  }

  if (!baseline) {
    return (
      <div className="p-6 text-sm text-muted">Baseline tidak tersedia. Coba muat ulang.</div>
    );
  }

  const totalDelta = simulation?.summary?.deltaPlanned ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="max-h-[520px] overflow-auto px-4 py-2">
        {mode === 'monthly' ? (
          <table className="w-full min-w-[640px] table-auto border-separate border-spacing-y-3">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2 text-right">Planned asli</th>
                <th className="px-3 py-2 text-right">Penyesuaian</th>
                <th className="px-3 py-2 text-right">Hasil</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const draft = getDraftValue(draftItems, category.categoryId);
                const locked = lockedCategoryIds.has(category.categoryId);
                const baselineWeeklyTotal = Object.values(category.weeklyPlanned ?? {}).reduce(
                  (sum, value) => sum + value,
                  0
                );
                const plannedBaseline = useWeeklyBudgets ? baselineWeeklyTotal : category.monthlyPlanned;
                const plannedResult = plannedBaseline + (locked ? 0 : draft.monthly);
                const invalid = plannedResult < 0;
                const projected = simulationMap.get(category.categoryId)?.projected ?? 0;

                return (
                  <tr key={category.categoryId} className="rounded-2xl bg-surface">
                    <td className="rounded-l-2xl px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-text">{category.categoryName}</span>
                        <span className="text-xs text-muted">{category.categoryType === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-muted">
                      {formatCurrency(plannedBaseline)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={locked ? 0 : draft.monthly}
                        onChange={(event) => {
                          const value = Number.parseFloat(event.target.value);
                          if (Number.isNaN(value)) {
                            onChange(category.categoryId, { monthly: 0 });
                            return;
                          }
                          if (plannedBaseline + value < 0) return;
                          onChange(category.categoryId, { monthly: value });
                        }}
                        className={`w-32 rounded-xl border px-3 py-2 text-right font-mono text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${
                          invalid ? 'border-rose-400 text-rose-400' : 'border-border bg-surface text-text'
                        } ${locked ? 'bg-border/40 text-muted' : ''}`}
                        aria-label={`Penyesuaian ${category.categoryName}`}
                        disabled={locked}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm">
                      <div className="flex flex-col items-end gap-1">
                        <span className={invalid ? 'text-rose-400' : 'text-text'}>
                          {formatCurrency(plannedResult)}
                        </span>
                        <span className="text-xs text-muted">Proyeksi: {formatCurrency(projected)}</span>
                      </div>
                    </td>
                    <td className="rounded-r-2xl px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            const next = draft.monthly + plannedBaseline * 0.05;
                            if (plannedBaseline + next < 0) return;
                            onChange(category.categoryId, { monthly: next });
                          }}
                          className="rounded-full border border-border px-2.5 py-1 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                          disabled={locked}
                        >
                          +5%
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = draft.monthly + plannedBaseline * 0.1;
                            if (plannedBaseline + next < 0) return;
                            onChange(category.categoryId, { monthly: next });
                          }}
                          className="rounded-full border border-border px-2.5 py-1 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                          disabled={locked}
                        >
                          +10%
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = draft.monthly - plannedBaseline * 0.1;
                            if (plannedBaseline + next < 0) return;
                            onChange(category.categoryId, { monthly: next });
                          }}
                          className="rounded-full border border-border px-2.5 py-1 transition hover:border-amber-500 hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                          disabled={locked}
                        >
                          −10%
                        </button>
                        <button
                          type="button"
                          onClick={() => onChange(category.categoryId, { monthly: 0 })}
                          className="rounded-full border border-border px-2.5 py-1 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleLock(category.categoryId)}
                          className={`rounded-full border px-2.5 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${
                            locked
                              ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]'
                              : 'border-border text-muted hover:text-text'
                          }`}
                          aria-pressed={locked}
                        >
                          {locked ? 'Unlock' : 'Lock'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => {
                const weeklyDeltas = ensureWeeklyDelta(draftItems, category.categoryId, weeklyStructure);
                const weeklySimulation = simulationMap.get(category.categoryId)?.weekly ?? [];
                const baselineWeekly: Record<string, number> = { ...(category.weeklyPlanned ?? {}) };
                const locked = lockedCategoryIds.has(category.categoryId);

              const orderedWeeks = Array.from(
                new Set([
                  ...weeklyStructure.map((week) => week.start),
                  ...Object.keys(weeklyDeltas),
                ])
              );

              return (
                <div key={category.categoryId} className="rounded-3xl border border-border/60 bg-surface/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text">{category.categoryName}</h3>
                      <p className="text-xs text-muted">{category.categoryType === 'income' ? 'Pemasukan' : 'Pengeluaran'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleLock(category.categoryId)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${
                        locked
                          ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]'
                          : 'border-border text-muted hover:text-text'
                      }`}
                    >
                      {locked ? 'Unlock' : 'Lock'}
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {orderedWeeks.map((weekStart) => {
                      const deltaValue = weeklyDeltas[weekStart] ?? 0;
                      const weeklyInfo = weeklySimulation.find((row) => row.weekStart === weekStart);
                      const baselineValue = weeklyInfo?.baseline ?? baselineWeekly[weekStart] ?? 0;
                      const result = baselineValue + (locked ? 0 : deltaValue);
                      const invalid = result < 0;
                      const label = weeklyStructure.find((week) => week.start === weekStart)?.label ?? weekStart;
                      return (
                        <label key={weekStart} className="flex flex-col gap-2 text-xs font-medium text-muted">
                          <span>{label}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={locked ? 0 : deltaValue}
                            onChange={(event) => {
                              const value = Number.parseFloat(event.target.value);
                              const parsed = Number.isNaN(value) ? 0 : value;
                              if (baselineValue + parsed < 0) return;
                              onChange(category.categoryId, {
                                weekly: { ...weeklyDeltas, [weekStart]: parsed },
                              });
                            }}
                            className={`w-full rounded-2xl border px-3 py-2 text-right font-mono text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${
                              invalid ? 'border-rose-400 text-rose-400' : 'border-border bg-surface text-text'
                            } ${locked ? 'bg-border/40 text-muted' : ''}`}
                            disabled={locked}
                          />
                          <span className={`font-mono ${invalid ? 'text-rose-400' : 'text-text'}`}>
                            {formatCurrency(result)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-auto border-t border-border/60 bg-surface/80 px-6 py-4">
        <div className="flex items-center justify-between text-sm font-semibold text-text">
          <span>Total Δ</span>
          <span className={`font-mono ${totalDelta >= 0 ? 'text-[color:var(--accent)]' : 'text-rose-400'}`}>
            {formatCurrency(totalDelta)}
          </span>
        </div>
      </div>
    </div>
  );
}

