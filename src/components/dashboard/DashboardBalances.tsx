import { Banknote, CreditCard, Wallet } from 'lucide-react';

import Skeleton from '../Skeleton';
import { formatCurrency } from '../../lib/format';
import useBalances from '../../hooks/useBalances';

const cards = [
  {
    key: 'cashTotal' as const,
    label: 'Uang Cash',
    Icon: Wallet,
  },
  {
    key: 'allTotal' as const,
    label: 'Total Saldo',
    Icon: Banknote,
  },
  {
    key: 'nonCashTotal' as const,
    label: 'Saldo Non-Cash',
    Icon: CreditCard,
  },
];

export default function DashboardBalances() {
  const { cashTotal, allTotal, nonCashTotal, loading, error, refetch } = useBalances();

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-border bg-card p-5 ring-2 ring-border/50">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="mt-4 h-10 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-semibold">Gagal memuat saldo</p>
        <p className="mt-1 text-xs opacity-80">{error.message || 'Silakan coba lagi.'}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  const values = {
    cashTotal,
    allTotal,
    nonCashTotal,
  } satisfies Record<(typeof cards)[number]['key'], number>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ key, label, Icon }) => (
        <div
          key={key}
          className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 ring-2 ring-border/50"
        >
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">
              {formatCurrency(values[key] ?? 0, 'IDR')}
            </p>
          </div>
          <span className="rounded-full bg-primary/10 p-2 text-primary">
            <Icon aria-hidden className="h-6 w-6" />
          </span>
        </div>
      ))}
    </div>
  );
}
