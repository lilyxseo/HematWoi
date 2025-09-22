import { memo, useMemo } from 'react';
import type { SubscriptionRecord } from '../../lib/api-subscriptions';
import { formatCurrency } from '../../lib/format';

export interface SubscriptionCardProps {
  subscription: SubscriptionRecord;
  onEdit(id: string): void;
  onDelete(id: string): void;
  onToggleStatus(id: string, next: SubscriptionRecord['status']): void;
}

const statusLabels: Record<SubscriptionRecord['status'], { label: string; tone: string }> = {
  active: { label: 'Aktif', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  paused: { label: 'Paused', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  canceled: { label: 'Canceled', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' },
};

function formatInterval(unit: SubscriptionRecord['interval_unit'], count: number) {
  if (count <= 1) {
    switch (unit) {
      case 'day':
        return 'Harian';
      case 'week':
        return 'Mingguan';
      case 'month':
        return 'Bulanan';
      case 'year':
        return 'Tahunan';
      default:
        return unit;
    }
  }
  const label =
    unit === 'day' ? 'hari' : unit === 'week' ? 'minggu' : unit === 'month' ? 'bulan' : 'tahun';
  return `${count} ${label}`;
}

function SubscriptionCardComponent({ subscription, onEdit, onDelete, onToggleStatus }: SubscriptionCardProps) {
  const amountLabel = useMemo(
    () => formatCurrency(subscription.amount, subscription.currency ?? 'IDR'),
    [subscription.amount, subscription.currency],
  );

  const intervalLabel = useMemo(
    () => formatInterval(subscription.interval_unit, subscription.interval_count ?? 1),
    [subscription.interval_unit, subscription.interval_count],
  );

  const nextDue = subscription.next_due_date
    ? new Date(subscription.next_due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const anchorDate = subscription.anchor_date
    ? new Date(subscription.anchor_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const statusInfo = statusLabels[subscription.status] ?? statusLabels.active;
  const isPaused = subscription.status === 'paused';
  const isCanceled = subscription.status === 'canceled';

  const toggleLabel = isCanceled ? 'Aktifkan' : isPaused ? 'Lanjutkan' : 'Jeda';
  const nextStatus: SubscriptionRecord['status'] = isCanceled
    ? 'active'
    : isPaused
    ? 'active'
    : 'paused';

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm shadow-black/5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-text">{subscription.name}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.tone}`}>{statusInfo.label}</span>
          </div>
          {subscription.vendor && <p className="text-sm text-muted">{subscription.vendor}</p>}
          <p className="text-sm text-text/80">
            {intervalLabel}
            {subscription.trial_end ? ` · Trial s.d. ${new Date(subscription.trial_end).toLocaleDateString('id-ID')}` : ''}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-muted">
            {subscription.category?.name && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subscription.category?.color ?? '#64748B' }} />
                {subscription.category?.name}
              </span>
            )}
            {subscription.account?.name && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1">
                {subscription.account?.name}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted">Nominal</p>
          <p className="text-lg font-semibold text-text">{amountLabel}</p>
          <p className="text-xs text-muted">Due berikutnya: {nextDue}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted">
          <p>Anchor: {anchorDate}</p>
          {subscription.notes && <p className="mt-1 line-clamp-2 text-xs text-muted">{subscription.notes}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onEdit(subscription.id)}
            className="h-11 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus(subscription.id, nextStatus)}
            className="h-11 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {toggleLabel}
          </button>
          <button
            type="button"
            onClick={() => onDelete(subscription.id)}
            className="h-11 rounded-2xl border border-rose-200 bg-rose-500/10 px-4 text-sm font-semibold text-rose-600 hover:bg-rose-500/20 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
          >
            Hapus
          </button>
        </div>
      </div>
    </article>
  );
}

const SubscriptionCard = memo(SubscriptionCardComponent);

export default SubscriptionCard;
