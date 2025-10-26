import { useMemo } from 'react';
import { Lock, Unlock } from 'lucide-react';
import clsx from 'clsx';
import { formatCurrency } from '../../../lib/format';
import type { SimulationCategoryResult } from '../../../lib/simMath';

type EditorMode = 'monthly' | 'weekly';

type BudgetSimulationEditorProps = {
  categories: SimulationCategoryResult[];
  weeks: string[];
  mode: EditorMode;
  locked: Set<string>;
  onChange: (categoryId: string, payload: { deltaMonthly?: number; deltaWeekly?: Record<string, number> }) => void;
  onReset: (categoryId: string) => void;
  onToggleLock: (categoryId: string) => void;
};

function formatWeekLabel(weekStart: string) {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
  });
  const end = new Date(date.getTime());
  end.setUTCDate(end.getUTCDate() + 6);
  return `${formatter.format(date)} – ${formatter.format(end)}`;
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

export default function BudgetSimulationEditor({
  categories,
  weeks,
  mode,
  locked,
  onChange,
  onReset,
  onToggleLock,
}: BudgetSimulationEditorProps) {
  const totalDelta = useMemo(
    () =>
      categories.reduce((sum, category) => {
        if (locked.has(category.categoryId)) return sum;
        return sum + category.totalDelta;
      }, 0),
    [categories, locked]
  );

  if (!categories.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-surface/50 p-10 text-center text-sm text-muted">
        <p>Pilih atau buat skenario untuk mulai menyimulasikan anggaran.</p>
      </div>
    );
  }

  const renderQuickActions = (category: SimulationCategoryResult, disabled: boolean) => {
    const buttons: Array<{ label: string; value: number }> = [
      { label: '+5%', value: category.baselinePlanned * 0.05 },
      { label: '+10%', value: category.baselinePlanned * 0.1 },
      { label: '−10%', value: category.baselinePlanned * -0.1 },
    ];
    return (
      <div className="flex flex-wrap gap-1 text-xs">
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange(category.categoryId, {
                deltaMonthly: clampDelta(category.baselinePlanned, category.deltaMonthly + button.value),
              })
            }
            className="inline-flex min-w-[56px] items-center justify-center rounded-xl border border-border/60 px-2 py-1 font-semibold text-muted transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
          >
            {button.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onReset(category.categoryId)}
          className="inline-flex min-w-[56px] items-center justify-center rounded-xl border border-border px-2 py-1 font-semibold text-muted transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
        >
          Reset
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-surface/60 shadow">
        {mode === 'monthly' ? (
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-surface/80 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                <th className="px-4 py-3 text-right font-semibold">Planned asli</th>
                <th className="px-4 py-3 text-right font-semibold">Penyesuaian</th>
                <th className="px-4 py-3 text-right font-semibold">Planned simulasi</th>
                <th className="px-4 py-3 text-left font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {categories.map((category) => {
                const isLocked = locked.has(category.categoryId);
                return (
                  <tr key={category.categoryId} className={clsx(isLocked ? 'opacity-60' : '')}>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-text">{category.categoryName}</span>
                        <span className="text-xs text-muted">Baseline: {formatCurrency(category.baselinePlanned, 'IDR')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums font-mono text-sm text-muted">
                      {formatCurrency(category.baselineMonthly, 'IDR')}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          value={category.deltaMonthly.toString()}
                          disabled={isLocked}
                          onChange={(event) => {
                            const raw = parseNumber(event.target.value);
                            onChange(category.categoryId, {
                              deltaMonthly: clampDelta(category.baselinePlanned, raw),
                            });
                          }}
                          className="h-10 w-32 rounded-xl border border-border bg-surface px-3 text-right font-mono text-sm text-text transition focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
                          aria-label={`Penyesuaian bulanan untuk ${category.categoryName}`}
                        />
                        <button
                          type="button"
                          onClick={() => onToggleLock(category.categoryId)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          aria-label={isLocked ? `Buka kunci ${category.categoryName}` : `Kunci ${category.categoryName}`}
                        >
                          {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums text-text">
                      {formatCurrency(category.simulationPlanned, 'IDR')}
                    </td>
                    <td className="px-4 py-4 text-left">{renderQuickActions(category, isLocked)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/60 text-sm">
              <thead className="bg-surface/80 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                  {weeks.map((week) => (
                    <th key={week} className="px-4 py-3 text-right font-semibold">
                      {formatWeekLabel(week)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-semibold">Total simulasi</th>
                  <th className="px-4 py-3 text-left font-semibold">Kunci</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categories.map((category) => {
                  const isLocked = locked.has(category.categoryId);
                  return (
                    <tr key={category.categoryId} className={clsx(isLocked ? 'opacity-60' : '')}>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-text">{category.categoryName}</span>
                          <span className="text-xs text-muted">Baseline: {formatCurrency(category.baselinePlanned, 'IDR')}</span>
                        </div>
                      </td>
                      {weeks.map((week) => {
                        const baselineValue = category.baselineWeekly[week] ?? 0;
                        const deltaValue = category.deltaWeekly[week] ?? 0;
                        return (
                          <td key={`${category.categoryId}-${week}`} className="px-4 py-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-muted">
                                {formatCurrency(baselineValue, 'IDR')}
                              </span>
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={deltaValue.toString()}
                                disabled={isLocked}
                                onChange={(event) => {
                                  const raw = parseNumber(event.target.value);
                                  const next = clampDelta(baselineValue, raw);
                                  onChange(category.categoryId, {
                                    deltaWeekly: {
                                      ...category.deltaWeekly,
                                      [week]: next,
                                    },
                                  });
                                }}
                                className="h-10 w-28 rounded-xl border border-border bg-surface px-2 text-right font-mono text-sm text-text transition focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
                                aria-label={`Penyesuaian minggu ${formatWeekLabel(week)} untuk ${category.categoryName}`}
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-4 text-right font-semibold tabular-nums text-text">
                        {formatCurrency(category.simulationPlanned, 'IDR')}
                      </td>
                      <td className="px-4 py-4 text-left">
                        <button
                          type="button"
                          onClick={() => onToggleLock(category.categoryId)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted transition hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          aria-label={isLocked ? `Buka kunci ${category.categoryName}` : `Kunci ${category.categoryName}`}
                        >
                          {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
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
      <div className="sticky bottom-0 flex items-center justify-between gap-4 rounded-3xl border border-border/60 bg-surface/90 px-5 py-4 shadow-xl shadow-black/5">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Total Δ Anggaran</span>
          <span className="font-mono text-lg font-semibold text-text">
            {formatCurrency(totalDelta, 'IDR')}
          </span>
        </div>
        <span className="text-xs text-muted">
          Gunakan tombol kunci untuk mengecualikan kategori dari perhitungan simulasi.
        </span>
      </div>
    </div>
  );
}

function clampDelta(baseline: number, delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  const min = -Math.max(0, baseline);
  if (delta < min) return min;
  return delta;
}

