import { memo } from 'react';
import { formatCurrency } from '../../lib/format';

const numberFormatter = new Intl.NumberFormat('id-ID');

export interface SummaryCardsProps {
  totalActive: number;
  forecastAmount: number;
  paidAmount: number;
  dueSoonCount: number;
  dueSoonAmount: number;
  loading?: boolean;
}

interface SummaryItemProps {
  label: string;
  value: string;
  sublabel?: string;
  loading?: boolean;
}

function SummaryItem({ label, value, sublabel, loading }: SummaryItemProps) {
  return (
    <div className="rounded-3xl border border-border-subtle bg-surface px-4 py-5 shadow-sm shadow-black/5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text">
        {loading ? <span className="inline-flex animate-pulse rounded-full bg-surface-2 px-3 py-1 text-sm">Memuat…</span> : value}
      </p>
      {sublabel && !loading && <p className="mt-1 text-xs text-muted">{sublabel}</p>}
    </div>
  );
}

function SummaryCardsComponent({
  totalActive,
  forecastAmount,
  paidAmount,
  dueSoonCount,
  dueSoonAmount,
  loading = false,
}: SummaryCardsProps) {
  const activeLabel = loading ? '—' : numberFormatter.format(totalActive);
  const dueSoonLabel = loading ? '—' : numberFormatter.format(dueSoonCount);
  const dueSoonSub = loading ? undefined : formatCurrency(dueSoonAmount || 0, 'IDR');

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryItem label="Total aktif" value={activeLabel} loading={loading} />
      <SummaryItem
        label="Forecast bulan ini"
        value={loading ? '—' : formatCurrency(forecastAmount || 0, 'IDR')}
        loading={loading}
      />
      <SummaryItem
        label="Paid bulan ini"
        value={loading ? '—' : formatCurrency(paidAmount || 0, 'IDR')}
        loading={loading}
      />
      <SummaryItem
        label="Due ≤7 hari"
        value={dueSoonLabel}
        sublabel={dueSoonSub}
        loading={loading}
      />
    </div>
  );
}

const SummaryCards = memo(SummaryCardsComponent);

export default SummaryCards;
