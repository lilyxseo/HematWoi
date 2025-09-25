import {
  Banknote,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import { ReactNode, useMemo } from "react";
import { formatRangeLabel, DateRangeValue } from "../../lib/date-range";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) =>
  currencyFormatter.format(Math.max(0, Math.trunc(value ?? 0)));

const formatSignedCurrency = (value: number, withPlus = false) => {
  const absolute = currencyFormatter.format(
    Math.max(0, Math.trunc(Math.abs(value ?? 0)))
  );
  if (value < 0) return `-${absolute}`;
  return withPlus ? `+${absolute}` : absolute;
};

interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

const SummaryCard = ({ icon, label, children, footer, className }: SummaryCardProps) => (
  <article
    className={clsx(
      "rounded-2xl border border-border/60 bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm backdrop-blur transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30",
      className
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary" title={label}>
        {icon}
      </div>
      {footer}
    </div>
    <div className="mt-6 space-y-3">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  </article>
);

const SkeletonValue = () => (
  <div className="h-7 w-24 animate-pulse rounded-xl bg-muted/50" />
);

const Sparkline = ({ values }: { values: number[] }) => {
  const points = useMemo(() => {
    if (!values.length) {
      return "";
    }
    const localMin = Math.min(...values);
    const localMax = Math.max(...values);
    const safeMin = Number.isFinite(localMin) ? localMin : 0;
    const safeMax = Number.isFinite(localMax) ? localMax : 0;
    const span = safeMax - safeMin || 1;
    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100;
        const y = 100 - ((value - safeMin) / span) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [values]);

  if (!points) {
    return (
      <div className="h-12 w-full rounded-xl bg-muted/40" aria-hidden />
    );
  }

  return (
    <svg
      viewBox="0 0 100 40"
      role="presentation"
      className="h-12 w-full text-primary"
    >
      <defs>
        <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      <polygon
        fill="url(#sparklineGradient)"
        points={`${points} 100,100 0,100`}
        opacity={0.35}
      />
    </svg>
  );
};

interface DashboardSummaryProps {
  range: DateRangeValue;
  income: number;
  expense: number;
  cashBalance: number;
  nonCashBalance: number;
  totalBalance: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const DashboardSummary = ({
  range,
  income,
  expense,
  cashBalance,
  nonCashBalance,
  totalBalance,
  loading,
  error,
  onRetry,
}: DashboardSummaryProps) => {
  const net = income - expense;
  const sparklineValues = useMemo(() => {
    const steps = 8;
    if (steps <= 1) return [net];
    return Array.from({ length: steps }, (_, index) => {
      const progress = index / (steps - 1);
      const gross = income * progress;
      const spend = expense * Math.pow(progress, 1.15);
      return gross - spend;
    });
  }, [income, expense, net]);

  const rangeLabel = useMemo(() => formatRangeLabel(range), [range]);

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Ringkasan keuangan
        </h2>
        <p className="text-sm text-muted-foreground">Periode {rangeLabel}</p>
      </header>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/30 dark:text-rose-200">
          <span>{error}</span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-rose-600/90 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-600"
            >
              Coba lagi
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Pemasukan"
          icon={<TrendingUp className="h-5 w-5" />}
          footer={
            <span className="rounded-full bg-emerald-100/70 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              Masuk
            </span>
          }
        >
          {loading ? (
            <SkeletonValue />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 md:text-3xl">
              {formatCurrency(income)}
            </div>
          )}
        </SummaryCard>

        <SummaryCard
          label="Pengeluaran"
          icon={<TrendingDown className="h-5 w-5" />}
          footer={
            <span className="rounded-full bg-rose-100/70 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
              Keluar
            </span>
          }
        >
          {loading ? (
            <SkeletonValue />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 md:text-3xl">
              {formatCurrency(expense)}
            </div>
          )}
        </SummaryCard>

        <SummaryCard
          label="Saldo Cash & Non-Cash"
          icon={<Wallet className="h-5 w-5" title="Saldo cash" />}
        >
          {loading ? (
            <SkeletonValue />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" title="Saldo cash" />
                  Cash
                </div>
                <span className="text-base font-semibold text-amber-600 dark:text-amber-400">
                  {formatCurrency(cashBalance)}
                </span>
              </div>
              <div className="h-px w-full bg-border/60" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-400" title="Saldo non-cash" />
                  Non-Cash
                </div>
                <span className="text-base font-semibold text-sky-600 dark:text-sky-400">
                  {formatCurrency(nonCashBalance)}
                </span>
              </div>
            </div>
          )}
        </SummaryCard>

        <SummaryCard
          label="Total Saldo"
          icon={<Banknote className="h-5 w-5" title="Total saldo" />}
          footer={
            loading ? null : (
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    net >= 0
                      ? "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                      : "bg-rose-100/70 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"
                  )}
                >
                  Net {formatSignedCurrency(net, true)} {net >= 0 ? "↑" : "↓"}
                </span>
              </div>
            )
          }
        >
          {loading ? (
            <SkeletonValue />
          ) : (
            <div className="space-y-4">
              <div className="text-2xl font-bold tracking-tight md:text-3xl">
                {formatCurrency(totalBalance)}
              </div>
              <Sparkline values={sparklineValues} />
            </div>
          )}
        </SummaryCard>
      </div>
    </section>
  );
};

export default DashboardSummary;

