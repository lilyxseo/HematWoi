import { Banknote, PieChart, Wallet } from 'lucide-react';
import useBalances from '../hooks/useBalances';
import { fmtIDR } from '../lib/balances';

type Totals = {
  cashTotal: number;
  nonCashTotal: number;
  allTotal: number;
};

const cards = [
  {
    key: 'cash',
    label: 'Uang Cash',
    icon: Wallet,
    valueSelector: (totals: Totals) => totals.cashTotal,
  },
  {
    key: 'all',
    label: 'Total Saldo',
    icon: Banknote,
    valueSelector: (totals: Totals) => totals.allTotal,
  },
  {
    key: 'non-cash',
    label: 'Saldo Non-Cash',
    icon: PieChart,
    valueSelector: (totals: Totals) => totals.nonCashTotal,
  },
] as const;

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-7 w-32 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm ring-1 ring-border/60">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{fmtIDR(value)}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export default function DashboardBalances() {
  const { cashTotal, nonCashTotal, allTotal, loading, error, refetch } = useBalances();

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5 text-red-700 ring-1 ring-red-300">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Gagal memuat saldo akun</p>
            <p className="text-sm text-red-600/80">{error.message || 'Terjadi kesalahan tak terduga.'}</p>
          </div>
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  const totals = { cashTotal, nonCashTotal, allTotal };

  return (
    <section aria-label="Ringkasan saldo" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {loading
        ? cards.map((card) => <SkeletonCard key={card.key} />)
        : cards.map((card) => (
            <StatCard key={card.key} label={card.label} value={card.valueSelector(totals)} icon={card.icon} />
          ))}
    </section>
  );
}
