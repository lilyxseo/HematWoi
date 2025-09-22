import { useMemo } from 'react';
import type { SubscriptionChargeRecord } from '../../lib/api-subscriptions';
import { formatCurrency } from '../../lib/format';

export interface UpcomingTableProps {
  charges: SubscriptionChargeRecord[];
  selectedIds: string[];
  loading?: boolean;
  onToggleSelect(id: string, selected: boolean): void;
  onToggleSelectAll(selected: boolean): void;
  onMarkPaid(id: string): void;
  onSkip(id: string, dueDate: string): void;
}

const statusTone: Record<string, string> = {
  due: 'bg-amber-500/15 text-amber-600',
  overdue: 'bg-rose-500/15 text-rose-600',
  paid: 'bg-emerald-500/15 text-emerald-600',
  skipped: 'bg-slate-500/15 text-slate-500',
  canceled: 'bg-slate-500/15 text-slate-500',
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatus(status: string) {
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

export default function UpcomingTable({
  charges,
  selectedIds,
  loading = false,
  onToggleSelect,
  onToggleSelectAll,
  onMarkPaid,
  onSkip,
}: UpcomingTableProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = charges.length > 0 && charges.every((charge) => selectedSet.has(charge.id));

  return (
    <div className="hidden overflow-hidden rounded-3xl border border-border-subtle bg-surface shadow-sm shadow-black/5 lg:block">
      <div className="max-h-[480px] overflow-y-auto">
        <table className="min-w-full divide-y divide-border-subtle text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Pilih semua"
                  className="h-4 w-4 rounded border-border text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  checked={allSelected}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                />
              </th>
              <th scope="col" className="px-4 py-3">Langganan</th>
              <th scope="col" className="px-4 py-3">Due</th>
              <th scope="col" className="px-4 py-3 text-right">Nominal</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                  Memuat tagihan…
                </td>
              </tr>
            )}
            {!loading && charges.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                  Tidak ada tagihan pada rentang ini.
                </td>
              </tr>
            )}
            {!loading &&
              charges.map((charge) => {
                const status = charge.status ?? 'due';
                const tone = statusTone[status] ?? statusTone.due;
                const subscription = charge.subscription;
                return (
                  <tr key={charge.id} className="align-top text-sm text-text">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${subscription?.name ?? 'langganan'}`}
                        className="h-4 w-4 rounded border-border text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                        checked={selectedSet.has(charge.id)}
                        onChange={(event) => onToggleSelect(charge.id, event.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-text">{subscription?.name ?? 'Langganan'}</div>
                      <div className="text-xs text-muted">{subscription?.vendor ?? '—'}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted">{formatDate(charge.due_date)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      {formatCurrency(charge.amount ?? 0, charge.currency ?? 'IDR')}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
                        {formatStatus(status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onMarkPaid(charge.id)}
                          disabled={status === 'paid'}
                          className="inline-flex h-9 items-center rounded-2xl border border-border bg-surface-2 px-3 text-xs font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Tandai Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => onSkip(charge.id, charge.due_date)}
                          disabled={status === 'skipped' || status === 'paid'}
                          className="inline-flex h-9 items-center rounded-2xl border border-border bg-surface-2 px-3 text-xs font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Skip
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
