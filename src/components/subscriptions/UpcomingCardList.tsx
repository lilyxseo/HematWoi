import { useMemo } from 'react';
import type { SubscriptionChargeRecord } from '../../lib/api-subscriptions';
import { formatCurrency } from '../../lib/format';

export interface UpcomingCardListProps {
  charges: SubscriptionChargeRecord[];
  selectedIds: string[];
  loading?: boolean;
  onToggleSelect(id: string, selected: boolean): void;
  onMarkPaid(id: string): void;
  onSkip(id: string, dueDate: string): void;
}

const statusClass: Record<string, string> = {
  due: 'bg-amber-500/15 text-amber-600',
  overdue: 'bg-rose-500/15 text-rose-600',
  paid: 'bg-emerald-500/15 text-emerald-600',
  skipped: 'bg-slate-500/15 text-slate-500',
  canceled: 'bg-slate-500/15 text-slate-500',
};

function formatStatusLabel(status: string) {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'skipped':
      return 'Skipped';
    case 'canceled':
      return 'Canceled';
    case 'overdue':
      return 'Overdue';
    default:
      return 'Due';
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UpcomingCardList({
  charges,
  selectedIds,
  loading = false,
  onToggleSelect,
  onMarkPaid,
  onSkip,
}: UpcomingCardListProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (loading) {
    return (
      <div className="space-y-3 lg:hidden">
        <div className="animate-pulse rounded-3xl border border-border-subtle bg-surface-2 p-4" />
        <div className="animate-pulse rounded-3xl border border-border-subtle bg-surface-2 p-4" />
      </div>
    );
  }

  if (!charges.length) {
    return (
      <div className="rounded-3xl border border-border-subtle bg-surface px-4 py-6 text-center text-sm text-muted lg:hidden">
        Tidak ada tagihan pada rentang ini.
      </div>
    );
  }

  return (
    <div className="space-y-3 lg:hidden">
      {charges.map((charge) => {
        const subscription = charge.subscription;
        const status = charge.status ?? 'due';
        const tone = statusClass[status] ?? statusClass.due;
        const checked = selectedSet.has(charge.id);
        return (
          <article key={charge.id} className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm shadow-black/5">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                aria-label={`Pilih ${subscription?.name ?? 'langganan'}`}
                className="mt-1 h-4 w-4 flex-shrink-0 rounded border-border text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                checked={checked}
                onChange={(event) => onToggleSelect(charge.id, event.target.checked)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-semibold text-text">{subscription?.name ?? 'Langganan'}</h4>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
                    {formatStatusLabel(status)}
                  </span>
                </div>
                <p className="text-sm text-muted">{subscription?.vendor ?? '—'}</p>
                <p className="mt-2 text-sm font-medium text-text">
                  {formatCurrency(charge.amount ?? 0, charge.currency ?? 'IDR')}
                </p>
                <p className="text-xs text-muted">Jatuh tempo: {formatDate(charge.due_date)}</p>
                {charge.notes && <p className="mt-2 text-xs text-muted">Catatan: {charge.notes}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => onMarkPaid(charge.id)}
                disabled={status === 'paid'}
                className="h-11 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Tandai Paid
              </button>
              <button
                type="button"
                onClick={() => onSkip(charge.id, charge.due_date)}
                disabled={status === 'skipped' || status === 'paid'}
                className="h-11 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Skip Sekali
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
