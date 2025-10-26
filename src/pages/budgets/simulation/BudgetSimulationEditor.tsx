import { useMemo } from 'react';
import clsx from 'clsx';
import { Lock, LockOpen } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatCurrency } from '../../../lib/format';
import type { BaselineData, SimulationCategorySnapshot } from '../../../lib/simScenarioApi';

export type EditorTab = 'monthly' | 'weekly';

interface BudgetSimulationEditorProps {
  baseline: BaselineData | null;
  categories: SimulationCategorySnapshot[];
  tab: EditorTab;
  lockedCategories: Set<string>;
  onTabChange: (tab: EditorTab) => void;
  onChangeMonthly: (categoryId: string, value: number) => void;
  onChangeWeekly: (categoryId: string, week: string, value: number) => void;
  onResetCategory: (categoryId: string) => void;
  onToggleLock: (categoryId: string) => void;
}

const TABS: { label: string; value: EditorTab }[] = [
  { label: 'Bulanan', value: 'monthly' },
  { label: 'Mingguan', value: 'weekly' },
];

function clampDelta(base: number, delta: number): number {
  if (!Number.isFinite(base)) return 0;
  if (!Number.isFinite(delta)) return 0;
  if (base + delta < 0) {
    return -base;
  }
  return delta;
}

function buildSummary(categories: SimulationCategorySnapshot[], tab: EditorTab) {
  const baseline = categories.reduce((acc, category) => {
    const base = tab === 'monthly'
      ? category.plannedMonthly
      : Object.values(category.plannedWeekly).reduce((sum, value) => sum + (value ?? 0), 0);
    return acc + base;
  }, 0);
  const simulated = categories.reduce((acc, category) => {
    const sim = tab === 'monthly'
      ? category.simulatedMonthly
      : Object.values(category.simulatedWeekly).reduce((sum, value) => sum + (value ?? 0), 0);
    return acc + sim;
  }, 0);
  return { baseline, simulated, delta: simulated - baseline };
}

function getWeekLabel(week: string): string {
  try {
    const date = new Date(`${week}T00:00:00`);
    const startLabel = format(date, 'd MMM', { locale: id });
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 6);
    const endLabel = format(endDate, 'd MMM', { locale: id });
    return `${startLabel} – ${endLabel}`;
  } catch (error) {
    return week;
  }
}

export default function BudgetSimulationEditor({
  baseline,
  categories,
  tab,
  lockedCategories,
  onTabChange,
  onChangeMonthly,
  onChangeWeekly,
  onResetCategory,
  onToggleLock,
}: BudgetSimulationEditorProps) {
  const summary = useMemo(() => buildSummary(categories, tab), [categories, tab]);
  const weeks = baseline?.weeks ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onTabChange(item.value)}
            className={clsx(
              'rounded-2xl px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              tab === item.value
                ? 'bg-accent text-white shadow'
                : 'bg-surface-subtle text-text-subtle hover:bg-surface'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex-1 overflow-auto">
        {tab === 'monthly' ? (
          <div className="space-y-3">
            {categories.map((category) => {
              const locked = lockedCategories.has(category.id);
              const delta = locked ? 0 : category.deltaMonthly;
              const simulated = locked ? category.plannedMonthly : category.simulatedMonthly;
              return (
                <div
                  key={category.id}
                  className={clsx(
                    'rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm transition',
                    locked ? 'opacity-70' : 'hover:border-accent/40'
                  )}
                >
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text">{category.name}</p>
                      <p className="text-xs uppercase tracking-wide text-text-subtle">{category.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-text-subtle">Planned</p>
                      <p className="font-mono font-semibold text-text">{formatCurrency(category.plannedMonthly)}</p>
                    </div>
                    <div className="flex min-w-[12rem] flex-col gap-2">
                      <label className="text-xs font-medium text-text-subtle" htmlFor={`delta-${category.id}`}>
                        Penyesuaian
                      </label>
                      <input
                        id={`delta-${category.id}`}
                        type="number"
                        inputMode="decimal"
                        step="1000"
                        className="input input-bordered w-full font-mono"
                        value={locked ? 0 : delta}
                        onChange={(event) => {
                          if (locked) return;
                          const value = clampDelta(category.plannedMonthly, Number(event.target.value ?? 0));
                          onChangeMonthly(category.id, value);
                        }}
                        disabled={locked}
                        aria-label={`Penyesuaian ${category.name}`}
                      />
                      <p className="text-xs text-text-subtle">
                        Hasil: <span className="font-mono font-semibold text-text">{formatCurrency(simulated)}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-xs">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            if (locked) return;
                            onChangeMonthly(category.id, clampDelta(category.plannedMonthly, category.plannedMonthly * 0.05));
                          }}
                          disabled={locked}
                        >
                          +5%
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            if (locked) return;
                            onChangeMonthly(category.id, clampDelta(category.plannedMonthly, category.plannedMonthly * 0.1));
                          }}
                          disabled={locked}
                        >
                          +10%
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => {
                            if (locked) return;
                            onChangeMonthly(category.id, clampDelta(category.plannedMonthly, -category.plannedMonthly * 0.1));
                          }}
                          disabled={locked}
                        >
                          −10%
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => onResetCategory(category.id)}
                        >
                          Reset
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => onToggleLock(category.id)}
                        aria-pressed={locked}
                        aria-label={locked ? `Buka kunci ${category.name}` : `Kunci ${category.name}`}
                      >
                        {locked ? <Lock className="mr-1 h-3.5 w-3.5" /> : <LockOpen className="mr-1 h-3.5 w-3.5" />}
                        {locked ? 'Unlock' : 'Lock'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-subtle text-sm">
              <thead className="bg-surface-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-subtle">Kategori</th>
                  {weeks.map((week) => (
                    <th key={week} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-subtle">
                      {getWeekLabel(week)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-subtle">Lock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {categories.map((category) => {
                  const locked = lockedCategories.has(category.id);
                  return (
                    <tr key={category.id} className={locked ? 'opacity-70' : undefined}>
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-text">{category.name}</div>
                        <div className="text-xs text-text-subtle">Total planned {formatCurrency(Object.values(category.plannedWeekly).reduce((sum, value) => sum + (value ?? 0), 0))}</div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs mt-2"
                          onClick={() => onResetCategory(category.id)}
                        >
                          Reset
                        </button>
                      </td>
                      {weeks.map((week) => {
                        const base = category.plannedWeekly[week] ?? 0;
                        const delta = locked ? 0 : (category.deltaWeekly[week] ?? 0);
                        const simulated = locked ? base : (category.simulatedWeekly[week] ?? base);
                        return (
                          <td key={week} className="px-3 py-3 align-top">
                            <div className="text-xs text-text-subtle">Planned: {formatCurrency(base)}</div>
                            <input
                              type="number"
                              inputMode="decimal"
                              className="mt-2 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 font-mono focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
                              value={locked ? 0 : delta}
                              onChange={(event) => {
                                if (locked) return;
                                const value = clampDelta(base, Number(event.target.value ?? 0));
                                onChangeWeekly(category.id, week, value);
                              }}
                              disabled={locked}
                              aria-label={`Penyesuaian minggu ${getWeekLabel(week)} untuk ${category.name}`}
                            />
                            <div className="mt-1 text-xs text-text-subtle">
                              Hasil: <span className="font-mono font-semibold text-text">{formatCurrency(simulated)}</span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right align-top">
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => onToggleLock(category.id)}
                          aria-pressed={locked}
                        >
                          {locked ? <Lock className="mr-1 h-3.5 w-3.5" /> : <LockOpen className="mr-1 h-3.5 w-3.5" />}
                          {locked ? 'Unlock' : 'Lock'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 mt-4 rounded-2xl border border-border-subtle bg-surface px-4 py-3 shadow">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-subtle">Total perubahan</p>
            <p className="font-mono text-lg font-semibold text-text">
              {formatCurrency(summary.delta)}
            </p>
          </div>
          <div className="flex flex-col text-right text-xs text-text-subtle">
            <span>Baseline: <span className="font-mono font-semibold text-text">{formatCurrency(summary.baseline)}</span></span>
            <span>Simulasi: <span className="font-mono font-semibold text-text">{formatCurrency(summary.simulated)}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
