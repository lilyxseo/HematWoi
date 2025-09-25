import { Banknote, PieChart, Wallet } from 'lucide-react';
import useBalances from '../hooks/useBalances';
import Skeleton from './Skeleton';
import { fmtIDR } from '../lib/format';

const CARDS = [
  {
    key: 'cash',
    title: 'Uang Cash',
    icon: Wallet,
    getValue: (cash: number, _nonCash: number, _all: number) => cash,
  },
  {
    key: 'total',
    title: 'Total Saldo',
    icon: Banknote,
    getValue: (_cash: number, _nonCash: number, all: number) => all,
  },
  {
    key: 'noncash',
    title: 'Saldo Non-Cash',
    icon: PieChart,
    getValue: (_cash: number, nonCash: number) => nonCash,
  },
] as const;

export default function DashboardBalances() {
  const { cashTotal, nonCashTotal, allTotal, loading, error, refetch } = useBalances();

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border border-border bg-surface-1 p-5 ring-1 ring-border/60"
          >
            <Skeleton className="h-7 w-24" />
            <Skeleton className="mt-4 h-7 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-danger">
        <p className="text-sm font-medium">Gagal memuat saldo akun.</p>
        <p className="mt-1 text-sm text-danger/80">{error}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-danger/40 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {CARDS.map(({ key, title, icon: Icon, getValue }) => (
        <article
          key={key}
          className="rounded-2xl border border-border bg-surface-1 p-5 ring-1 ring-border/60"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {title}
              </p>
              <p className="text-2xl font-bold text-text">
                {fmtIDR(getValue(cashTotal, nonCashTotal, allTotal))}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
