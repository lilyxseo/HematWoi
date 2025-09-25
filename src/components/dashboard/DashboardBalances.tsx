import { Banknote, PieChart, Wallet } from 'lucide-react';
import Skeleton from '../Skeleton';
import { formatCurrency } from '../../lib/format';
import useBalances from '../../hooks/useBalances';

const CARD_STYLES =
  'rounded-2xl border border-surface-3 bg-surface-1 p-5 ring-2 ring-transparent shadow-sm';
const RETRY_BUTTON_CLASSES =
  'mt-4 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600';

const SkeletonCard = () => (
  <div className={CARD_STYLES}>
    <Skeleton className="h-7 w-24" />
    <Skeleton className="mt-4 h-7 w-32" />
  </div>
);

export default function DashboardBalances() {
  const { cashTotal, nonCashTotal, allTotal, loading, error, refetch } = useBalances();

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-700 ring-2 ring-red-200">
        <p className="font-semibold">Gagal memuat saldo</p>
        <p className="mt-1 text-sm text-red-600/80">{error}</p>
        <button type="button" onClick={refetch} className={RETRY_BUTTON_CLASSES}>
          Coba lagi
        </button>
      </div>
    );
  }

  const cards = [
    {
      key: 'cash',
      label: 'Uang Cash',
      value: cashTotal,
      icon: Wallet,
      iconClass: 'text-emerald-500',
    },
    {
      key: 'total',
      label: 'Total Saldo',
      value: allTotal,
      icon: Banknote,
      iconClass: 'text-primary',
    },
    {
      key: 'non-cash',
      label: 'Saldo Non-Cash',
      value: nonCashTotal,
      icon: PieChart,
      iconClass: 'text-indigo-500',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ key, label, value, icon: Icon, iconClass }) => (
        <div key={key} className={`${CARD_STYLES} flex items-center justify-between`}>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(value ?? 0)}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 ${iconClass}`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  );
}
