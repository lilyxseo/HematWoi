import { useMemo } from 'react';
import { Lock, Unlock } from 'lucide-react';
import clsx from 'clsx';
import type {
  BaselineDataset,
  SimulationResult,
  SimulationDraftItem,
} from '../../../../lib/simMath';
import { formatCurrency } from '../../../../lib/simMath';

interface BudgetSimulationEditorProps {
  mode: 'monthly' | 'weekly';
  baseline: BaselineDataset | null;
  simulation: SimulationResult | null;
  includeWeekly: boolean;
  draftItems: Record<string, SimulationDraftItem>;
  lockedCategoryIds: Set<string>;
  onMonthlyChange: (categoryId: string, value: number) => void;
  onWeeklyChange: (categoryId: string, weekStart: string, value: number) => void;
  onResetCategory: (categoryId: string) => void;
  onToggleLock: (categoryId: string) => void;
  onQuickAdjust: (categoryId: string, percent: number, baselineValue: number) => void;
}

const PERCENT_ACTIONS = [
  { label: '+5%', value: 0.05 },
  { label: '+10%', value: 0.1 },
  { label: '−10%', value: -0.1 },
];

export default function BudgetSimulationEditor({
  mode,
  baseline,
  simulation,
  includeWeekly,
  draftItems,
  lockedCategoryIds,
  onMonthlyChange,
  onWeeklyChange,
  onResetCategory,
  onToggleLock,
  onQuickAdjust,
}: BudgetSimulationEditorProps) {
  const categories = useMemo(() => {
    if (simulation) {
      return [...simulation.categories].sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    }
    if (!baseline) return [];
    return [...baseline.categories].sort((a, b) => a.categoryName.localeCompare(b.categoryName)).map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      categoryType: category.categoryType,
      baselinePlanned: includeWeekly
        ? Object.values(category.weeklyPlanned).reduce((acc, value) => acc + Number(value ?? 0), 0)
        : Number(category.monthlyPlanned ?? 0),
      simulatedPlanned: includeWeekly
        ? Object.values(category.weeklyPlanned).reduce((acc, value) => acc + Number(value ?? 0), 0)
        : Number(category.monthlyPlanned ?? 0),
      deltaPlanned: 0,
      actualMtd: category.actualMtd,
      projectedEom: category.actualMtd,
      weeklyDetails: baseline.weeks.map((week) => ({
        weekStart: week.start,
        baseline: Number(category.weeklyPlanned[week.start] ?? 0),
        delta: 0,
        simulated: Number(category.weeklyPlanned[week.start] ?? 0),
        actual: Number(category.weeklyActual[week.start] ?? 0),
      })),
    }));
  }, [baseline, includeWeekly, simulation]);

  if (!baseline) {
    return null;
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-alt/70 p-6 text-sm text-muted">
        Belum ada kategori yang memiliki baseline anggaran untuk bulan ini.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text">Editor Anggaran</h3>
        <p className="text-xs text-muted">
          Input di bawah ini hanya memengaruhi simulasi sampai kamu menyimpan atau menerapkan.
        </p>
      </div>

      {mode === 'monthly' ? (
        <div className="overflow-hidden rounded-2xl border border-border-subtle">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-surface-alt/60 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                <th className="px-4 py-3 text-right font-semibold">Planned asli</th>
                <th className="px-4 py-3 text-right font-semibold">Penyesuaian</th>
                <th className="px-4 py-3 text-right font-semibold">Simulasi</th>
                <th className="px-4 py-3 text-center font-semibold">Aksi cepat</th>
                <th className="px-4 py-3 text-center font-semibold">Lock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-surface/80">
              {categories.map((category) => {
                const draft = draftItems[category.categoryId];
                const locked = lockedCategoryIds.has(category.categoryId);
                const baselineValue = category.baselinePlanned;
                const deltaValue = draft?.deltaMonthly ?? 0;
                const simulated = Math.max(0, baselineValue + deltaValue);
                const invalid = !locked && baselineValue + deltaValue < 0;
                return (
                  <tr key={category.categoryId} className={locked ? 'opacity-70' : undefined}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-text">{category.categoryName}</div>
                      <div className="text-xs text-muted">{category.categoryType === 'income' ? 'Pendapatan' : 'Pengeluaran'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-muted">
                      {formatCurrency(baselineValue)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={locked ? 0 : deltaValue}
                        disabled={locked}
                        onChange={(event) => onMonthlyChange(category.categoryId, Number(event.target.value))}
                        className="w-28 rounded-lg border border-border/60 bg-surface px-2 py-1 text-right font-mono text-sm text-text shadow-inner focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/60 disabled:cursor-not-allowed"
                        aria-label={`Penyesuaian kategori ${category.categoryName}`}
                      />
                      {invalid ? (
                        <p className="mt-1 text-xs text-rose-400">Nilai simulasi tidak boleh negatif.</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-text">
                      {formatCurrency(simulated)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                        {PERCENT_ACTIONS.map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            disabled={locked}
                            onClick={() => onQuickAdjust(category.categoryId, action.value, baselineValue)}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-border/60 px-2 text-[11px] font-semibold text-muted transition hover:border-accent/60 hover:text-text disabled:cursor-not-allowed"
                          >
                            {action.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onResetCategory(category.categoryId)}
                          className="inline-flex h-7 items-center justify-center rounded-lg border border-border/60 px-2 text-[11px] font-semibold text-muted transition hover:border-accent/60 hover:text-text disabled:cursor-not-allowed"
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onToggleLock(category.categoryId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface text-muted transition hover:border-accent/60 hover:text-text"
                        aria-label={locked ? `Buka kunci ${category.categoryName}` : `Kunci ${category.categoryName}`}
                      >
                        {locked ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Unlock className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => {
            const draft = draftItems[category.categoryId];
            const locked = lockedCategoryIds.has(category.categoryId);
            return (
              <div
                key={category.categoryId}
                className={clsx(
                  'rounded-2xl border border-border-subtle bg-surface/80 p-4 shadow-sm',
                  locked && 'opacity-70'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text">{category.categoryName}</p>
                    <p className="text-xs text-muted">{category.categoryType === 'income' ? 'Pendapatan' : 'Pengeluaran'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleLock(category.categoryId)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface text-muted transition hover:border-accent/60 hover:text-text"
                    aria-label={locked ? `Buka kunci ${category.categoryName}` : `Kunci ${category.categoryName}`}
                  >
                    {locked ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Unlock className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {category.weeklyDetails.map((detail) => {
                    const weeklyDraft = draft?.deltaWeekly?.[detail.weekStart] ?? 0;
                    const invalid = !locked && detail.baseline + weeklyDraft < 0;
                    return (
                      <div key={detail.weekStart} className="rounded-xl border border-border/60 bg-surface-alt/60 p-3">
                        <p className="text-xs font-semibold text-text">Minggu mulai {detail.weekStart}</p>
                        <p className="text-[11px] text-muted">Planned: {formatCurrency(detail.baseline)}</p>
                        <label className="mt-2 block text-[11px] font-semibold text-text">
                          Penyesuaian
                          <input
                            type="number"
                            disabled={locked}
                            value={locked ? 0 : weeklyDraft}
                            onChange={(event) => onWeeklyChange(category.categoryId, detail.weekStart, Number(event.target.value))}
                            className="mt-1 w-full rounded-lg border border-border/60 bg-surface px-2 py-1 text-right font-mono text-sm text-text shadow-inner focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/60 disabled:cursor-not-allowed"
                          />
                        </label>
                        <p className="mt-1 text-[11px] text-muted">Simulasi: {formatCurrency(Math.max(0, detail.baseline + weeklyDraft))}</p>
                        {invalid ? <p className="text-[11px] text-rose-400">Tidak boleh negatif</p> : null}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {PERCENT_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={locked}
                      onClick={() => onQuickAdjust(category.categoryId, action.value, category.baselinePlanned)}
                      className="inline-flex h-7 items-center justify-center rounded-lg border border-border/60 px-2 text-[11px] font-semibold text-muted transition hover:border-accent/60 hover:text-text disabled:cursor-not-allowed"
                    >
                      {action.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onResetCategory(category.categoryId)}
                    className="inline-flex h-7 items-center justify-center rounded-lg border border-border/60 px-2 text-[11px] font-semibold text-muted transition hover:border-accent/60 hover:text-text disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-text shadow backdrop-blur">
        Total perubahan penyesuaian: <span className="font-mono font-semibold">{formatCurrency(simulation?.summary.totalDeltaPlanned ?? 0)}</span>
      </div>
    </div>
  );
}
