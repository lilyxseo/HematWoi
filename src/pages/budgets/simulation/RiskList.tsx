import clsx from 'clsx';
import { useMemo } from 'react';
import type { ProjectionMethod, RiskTier } from '../../../lib/simMath';
import { getRiskTier, projectAmount } from '../../../lib/simMath';
import type { SimulationSnapshot } from '../../../lib/simScenarioApi';
import { formatCurrency } from '../../../lib/format';

interface RiskListProps {
  snapshot: SimulationSnapshot;
  projectionMethod: ProjectionMethod;
  includeWeekly: boolean;
}

interface RiskItem {
  id: string;
  name: string;
  planned: number;
  projected: number;
  percentage: number;
  tier: RiskTier;
  weeklyActuals: number[];
}

const BADGE_CLASS: Record<RiskTier, string> = {
  low: 'bg-accent/10 text-accent',
  medium: 'bg-amber-500/15 text-amber-400',
  high: 'bg-orange-500/15 text-orange-400',
  critical: 'bg-rose-500/15 text-rose-400',
};

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((acc, value) => acc + (value ?? 0), 0);
}

function buildSparkline(values: number[], width = 120, height = 32): string {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const min = 0;
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const normalized = max === min ? 0 : (value - min) / (max - min);
    const y = height - normalized * height;
    return `${x},${y}`;
  });
  return points.join(' ');
}

export default function RiskList({ snapshot, projectionMethod, includeWeekly }: RiskListProps) {
  const items = useMemo<RiskItem[]>(() => {
    const context = {
      periodMonth: snapshot.baseline.periodMonth,
      daysInMonth: snapshot.baseline.daysInMonth,
      daysElapsed: snapshot.baseline.daysElapsed,
      totalWeeks: Math.max(snapshot.baseline.weeks.length, 1),
    };

    const candidates: RiskItem[] = snapshot.categories
      .filter((category) => category.type === 'expense')
      .map((category) => {
        const planned = includeWeekly ? sumRecord(category.simulatedWeekly) : category.simulatedMonthly;
        const projected = projectAmount(projectionMethod, context, {
          actualMtd: category.actualMtd,
          weeklyActuals: snapshot.baseline.weeks.map((week) => category.weeklyActuals[week] ?? 0),
          trailingWeeklyActuals: category.trailingWeeklyActuals,
        });
        const percentage = planned > 0 ? projected / planned : 0;
        const tier = getRiskTier(percentage);
        return {
          id: category.id,
          name: category.name,
          planned,
          projected,
          percentage,
          tier,
          weeklyActuals: snapshot.baseline.weeks.map((week) => category.weeklyActuals[week] ?? 0),
        };
      })
      .filter((item) => item.percentage >= 0.75);

    return candidates.sort((a, b) => b.percentage - a.percentage).slice(0, 6);
  }, [snapshot, projectionMethod, includeWeekly]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-subtle px-4 py-5 text-sm text-text-subtle">
        Semua kategori dalam kondisi aman. 🎉
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const path = buildSparkline(item.weeklyActuals);
        return (
          <div key={item.id} className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text">{item.name}</p>
                <p className="text-xs text-text-subtle">Projected: {formatCurrency(item.projected)}</p>
              </div>
              <span
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                  BADGE_CLASS[item.tier]
                )}
              >
                {(item.percentage * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="space-y-1 text-xs text-text-subtle">
                <div className="flex items-center justify-between">
                  <span>Planned</span>
                  <span className="font-mono font-semibold text-text">{formatCurrency(item.planned)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Projected</span>
                  <span className="font-mono font-semibold text-text">{formatCurrency(item.projected)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-surface-subtle">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{ width: `${Math.min(item.percentage, 1.2) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-center">
                <svg viewBox="0 0 120 32" className="h-16 w-full text-accent" aria-hidden="true">
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={path}
                  />
                </svg>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
