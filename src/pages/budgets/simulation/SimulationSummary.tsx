import clsx from 'clsx';
import { formatCurrency } from '../../../lib/format';
import type { ProjectionMethod, SimulationImpact, SimulationTotals } from '../../../lib/simMath';

interface SimulationSummaryProps {
  totals: SimulationTotals;
  impact: SimulationImpact;
  projectionMethod: ProjectionMethod;
  includeWeekly: boolean;
  onProjectionChange: (method: ProjectionMethod) => void;
  onIncludeWeeklyChange: (value: boolean) => void;
}

const PROJECTION_OPTIONS: { value: ProjectionMethod; label: string; description: string }[] = [
  { value: 'linear', label: 'Linear MTD', description: 'Rata-rata harian dikali jumlah hari' },
  { value: 'recent', label: '4 minggu', description: 'Rata-rata 4 minggu terakhir' },
  { value: 'flat', label: 'Tetap', description: 'Gunakan realisasi MTD saat ini' },
];

export default function SimulationSummary({
  totals,
  impact,
  projectionMethod,
  includeWeekly,
  onProjectionChange,
  onIncludeWeeklyChange,
}: SimulationSummaryProps) {
  const cards = [
    {
      label: 'Planned baseline',
      value: formatCurrency(totals.baselinePlanned, 'IDR'),
      subtitle: 'Total anggaran sebelum simulasi',
    },
    {
      label: 'Planned simulasi',
      value: formatCurrency(totals.simulationPlanned, 'IDR'),
      subtitle: 'Total setelah penyesuaian',
    },
    {
      label: 'Actual MTD',
      value: formatCurrency(totals.actualMtd, 'IDR'),
      subtitle: 'Realisasi bulan berjalan',
    },
    {
      label: 'Projected EOM',
      value: formatCurrency(totals.projectedEom, 'IDR'),
      subtitle: 'Perkiraan akhir bulan',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-3xl border border-border/60 bg-surface/70 p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{card.label}</p>
            <p className="mt-2 font-mono text-lg font-semibold text-text">{card.value}</p>
            <p className="text-xs text-muted">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-3xl border border-border/60 bg-surface/80 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-text">Metode proyeksi</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Gunakan weekly budgets</span>
              <button
                type="button"
                onClick={() => onIncludeWeeklyChange(!includeWeekly)}
                className={clsx(
                  'inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                  includeWeekly
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-surface text-muted hover:border-brand/40 hover:text-text'
                )}
                aria-pressed={includeWeekly}
              >
                {includeWeekly ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {PROJECTION_OPTIONS.map((option) => {
              const active = projectionMethod === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onProjectionChange(option.value)}
                  className={clsx(
                    'flex w-full flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                    active
                      ? 'border-brand/60 bg-brand/10 text-brand'
                      : 'border-border/60 bg-surface/60 text-text hover:border-brand/40'
                  )}
                  aria-pressed={active}
                >
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="text-xs text-muted">{option.description}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-3xl border border-border/60 bg-surface/80 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-text">Dampak saldo akhir bulan</h3>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Pendapatan</span>
              <span className="font-mono font-semibold text-emerald-500">
                {formatCurrency(impact.incomeDelta, 'IDR')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pengeluaran</span>
              <span className="font-mono font-semibold text-rose-500">
                {formatCurrency(impact.expenseDelta, 'IDR')}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-3 text-base font-semibold">
              <span>Perkiraan perubahan saldo</span>
              <span className={clsx('font-mono', impact.netDelta >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                {formatCurrency(impact.netDelta, 'IDR')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

