import type { GoalsSummary } from '../../lib/api-goals';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatCurrency(value?: number | null) {
  return currencyFormatter.format(Math.max(0, Number(value ?? 0)));
}

interface SummaryCardsProps {
  summary: GoalsSummary | null;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
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
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Goal Aktif</p>
        <p className="text-2xl font-bold tracking-tight text-text md:text-3xl">{totalActive}</p>
        <p className="text-xs text-muted">Jumlah goal dengan status aktif saat ini.</p>
      </article>

      <article className="card min-w-0 space-y-2 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm md:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Terkumpul Bulan Ini</p>
        <p className="text-2xl font-bold tracking-tight text-emerald-500 dark:text-emerald-300 md:text-3xl">
          {formatCurrency(totalSavedThisMonth)}
        </p>
        <p className="text-xs text-muted">Akumulasi setoran dari goal selama bulan berjalan.</p>
      </article>

      <article className="card min-w-0 space-y-2 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm md:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sisa Menuju Target Terdekat</p>
        <p className="text-2xl font-bold tracking-tight text-sky-500 dark:text-sky-300 md:text-3xl">
          {nearestRemaining != null ? formatCurrency(nearestRemaining) : '—'}
        </p>
        <p className="text-xs text-muted">Selisih target goal terdekat yang belum tercapai.</p>
      </article>

      <article className="card min-w-0 space-y-2 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-sm md:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">On-track vs Off-track</p>
        <p className="text-2xl font-bold tracking-tight text-brand md:text-3xl">{onTrackPercentage}%</p>
        <p className="text-xs text-muted">
          {onTrackCount} on-track • {offTrackCount} off-track dari {totalTracked} goal aktif.
        </p>
      </article>
    </section>
  );
}
