import { Sparkles, Target, TrendingUp } from 'lucide-react';
import type { GoalsSummary } from '../../lib/api-goals';
import { formatMoney } from '../../lib/format';

function formatCurrency(value?: number | null) {
  return formatMoney(Math.max(0, Number(value ?? 0)), 'IDR');
}

interface SummaryCardsProps {
  summary: GoalsSummary | null;
  nearestGoalTitle?: string | null;
}

export default function SummaryCards({ summary, nearestGoalTitle }: SummaryCardsProps) {
  const totalActive = summary?.totalActive ?? 0;
  const totalSavedThisMonth = summary?.totalSavedThisMonth ?? 0;
  const nearestRemaining = summary?.nearestRemaining ?? null;
  const onTrackPercentage = summary?.onTrackPercentage ?? 0;
  const onTrackCount = summary?.onTrackCount ?? 0;
  const totalTracked = summary?.totalTracked ?? 0;
  const offTrackCount = Math.max(totalTracked - onTrackCount, 0);

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article className="card min-w-0 space-y-2 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm md:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Goal Aktif</p>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-brand">
            <Target className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="text-2xl font-bold tracking-tight text-text md:text-3xl">{totalActive}</p>
        <p className="text-xs text-muted">Jumlah goal dengan status aktif saat ini.</p>
      </article>

      <article className="card min-w-0 space-y-2 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm md:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Terkumpul Bulan Ini</p>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="text-2xl font-bold tracking-tight text-emerald-500 dark:text-emerald-300 md:text-3xl hw-money">
          {formatCurrency(totalSavedThisMonth)}
        </p>
        <p className="text-xs text-muted">Akumulasi setoran dari goal selama bulan berjalan.</p>
      </article>

      <article className="card min-w-0 space-y-2 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm md:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sisa Menuju Target Terdekat</p>
        <p className="text-2xl font-bold tracking-tight text-sky-500 dark:text-sky-300 md:text-3xl hw-money">
          {nearestRemaining != null ? formatCurrency(nearestRemaining) : '—'}
        </p>
        <p className="text-xs text-muted">
          {nearestGoalTitle ? `Target: ${nearestGoalTitle}` : 'Selisih target goal terdekat yang belum tercapai.'}
        </p>
      </article>

      <article className="card min-w-0 space-y-2 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm md:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">On-track vs Off-track</p>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-brand">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <p className="text-2xl font-bold tracking-tight text-brand md:text-3xl">{onTrackPercentage}%</p>
        <p className="text-xs text-muted">
          {onTrackCount} on-track • {offTrackCount} off-track dari {totalTracked} goal aktif.
        </p>
        <div className="h-2 w-full rounded-full bg-border/60">
          <div
            className="h-2 rounded-full bg-brand transition-all"
            style={{ width: `${Math.min(100, Math.max(0, onTrackPercentage))}%` }}
          />
        </div>
      </article>
    </section>
  );
}
