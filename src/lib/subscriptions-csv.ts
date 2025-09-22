import type { SubscriptionRecord, SubscriptionChargeRecord } from './api-subscriptions';
import type { SubscriptionFilterState } from '../components/subscriptions/SubscriptionsFilterBar';

interface ExportOptions {
  subscriptions: SubscriptionRecord[];
  charges: SubscriptionChargeRecord[];
  filters: SubscriptionFilterState;
}

function escapeCsv(value: unknown): string {
  if (value == null) return '';
  const str = String(value).replace(/\r?\n|\r/g, ' ').trim();
  if (str.includes(',') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatIntervalValue(unit?: string | null, count?: number | null): string {
  if (!unit) return '';
  const safeCount = count && count > 0 ? count : 1;
  if (safeCount <= 1) return unit;
  return `${safeCount} ${unit}`;
}

function formatInterval(subscription: SubscriptionRecord): string {
  return formatIntervalValue(subscription.interval_unit, subscription.interval_count);
}

function timestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

export async function exportSubscriptionsCsv({ subscriptions, charges, filters }: ExportOptions): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('Fitur ekspor hanya tersedia di browser.');
  }

  const lines: string[] = [];
  const meta: Array<[string, string]> = [
    ['Diekspor pada', new Date().toLocaleString('id-ID')],
    ['Pencarian', filters.q || '—'],
    ['Status', filters.status],
    ['Kategori', filters.categoryId],
    ['Akun', filters.accountId],
    ['Periode', filters.unit],
    ['Due dari', filters.dueFrom ?? '—'],
    ['Due sampai', filters.dueTo ?? '—'],
    ['Dibuat dari', filters.createdFrom ?? '—'],
    ['Dibuat sampai', filters.createdTo ?? '—'],
  ];

  meta.forEach(([label, value]) => {
    lines.push(`${escapeCsv(label)},${escapeCsv(value)}`);
  });

  lines.push('');
  lines.push(
    [
      'type',
      'subscription_name',
      'vendor',
      'category',
      'account',
      'status',
      'interval',
      'amount',
      'currency',
      'next_due',
      'charge_due',
      'charge_status',
      'charge_amount',
      'notes',
    ]
      .map(escapeCsv)
      .join(','),
  );

  subscriptions.forEach((subscription) => {
    lines.push(
      [
        'subscription',
        subscription.name,
        subscription.vendor ?? '',
        subscription.category?.name ?? '',
        subscription.account?.name ?? '',
        subscription.status,
        formatInterval(subscription),
        subscription.amount,
        subscription.currency,
        subscription.next_due_date ?? '',
        '',
        '',
        '',
        subscription.notes ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    );
  });

  charges.forEach((charge) => {
    const subscription = charge.subscription;
    lines.push(
      [
        'charge',
        subscription?.name ?? '',
        subscription?.vendor ?? '',
        subscription?.category_id ?? '',
        subscription?.account_id ?? '',
        subscription?.status ?? '',
        formatIntervalValue(subscription?.interval_unit, subscription?.interval_count),
        subscription?.amount ?? '',
        subscription?.currency ?? '',
        subscription?.next_due_date ?? '',
        charge.due_date ?? '',
        charge.status ?? '',
        charge.amount ?? '',
        charge.notes ?? '',
      ]
        .map(escapeCsv)
        .join(','),
    );
  });

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `hematwoi-subscriptions-${timestamp()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
