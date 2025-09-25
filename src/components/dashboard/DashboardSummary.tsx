import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';

const fmtIDR = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.trunc(value ?? 0));

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type DashboardSummaryProps = {
  income: number;
  expense: number;
  cashBalance: number;
  nonCashBalance: number;
  totalBalance: number;
  netTrend?: number[];
  periodLabel: string;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
};

type SummaryCardProps = {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  accentClassName?: string;
  loading?: boolean;
  helperText?: string;
  footer?: ReactNode;
};

function SkeletonValue() {
  return <span className="inline-block h-7 w-32 animate-pulse rounded-full bg-muted/60" />;
}

function SummaryCard({
  label,
  icon,
  value,
  accentClassName,
  loading,
  helperText,
  footer,
}: SummaryCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm backdrop-blur transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className={cx('text-2xl font-bold tracking-tight md:text-3xl', accentClassName)}>
            {loading ? <SkeletonValue /> : value}
          </div>
          {helperText ? (
            loading ? (
              <span className="inline-block h-5 w-24 animate-pulse rounded-full bg-muted/40" />
            ) : (
              <p className="text-xs text-muted-foreground">{helperText}</p>
            )
          ) : null}
        </div>
        <div className="h-9 w-9 shrink-0 rounded-xl bg-primary/10 text-primary">
          <div className="grid h-full w-full place-items-center" title={label}>
            {icon}
          </div>
        </div>
      </div>
      {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
    </article>
  );
}

type SparklineProps = {
  data: number[];
  loading?: boolean;
};

function Sparkline({ data, loading }: SparklineProps) {
  if (loading) {
    return (
      <div className="h-12 w-full animate-pulse rounded-xl bg-muted/40" aria-hidden="true" />
    );
  }

  if (!data.length) {
    return (
      <div className="flex h-12 w-full items-center justify-center rounded-xl bg-muted/40 text-xs text-muted-foreground">
        Tidak ada data tren
      </div>
    );
  }

  const maxAbs = Math.max(...data.map((value) => Math.abs(value)), 1);

  return (
    <div className="flex h-12 w-full items-end gap-1 rounded-xl bg-muted/30 p-2">
      {data.map((value, index) => {
        const height = Math.max(4, Math.round((Math.abs(value) / maxAbs) * 100));
        const positive = value >= 0;
        return (
          <span
            key={`${index}-${value}`}
            className={cx(
              'w-2 rounded-full transition-colors',
              positive
                ? 'bg-emerald-400/70 group-hover:bg-emerald-400'
                : 'bg-rose-400/70 group-hover:bg-rose-400'
            )}
            style={{ height: `${height}%` }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

export default function DashboardSummary({
  income,
  expense,
  cashBalance,
  nonCashBalance,
  totalBalance,
  netTrend = [],
  periodLabel,
  loading,
  error,
  onRetry,
}: DashboardSummaryProps) {
  const net = income - expense;
  const netPositive = net >= 0;

  return (
    <section className="space-y-4">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200/60 bg-rose-100/50 p-4 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          <div className="text-sm">{error}</div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-rose-500/40 bg-transparent px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-200"
            >
              Coba lagi
            </button>
          )}
        </div>
      ) : null}

      <div className="text-sm text-muted-foreground">Periode {periodLabel}</div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Pemasukan"
          icon={<TrendingUp className="h-5 w-5" />}
          value={<span className="text-emerald-600 dark:text-emerald-400">{fmtIDR(income)}</span>}
          accentClassName="text-emerald-600 dark:text-emerald-400"
          loading={loading}
          helperText={`Periode ${periodLabel}`}
        />
        <SummaryCard
          label="Pengeluaran"
          icon={<TrendingDown className="h-5 w-5" />}
          value={<span className="text-rose-600 dark:text-rose-400">{fmtIDR(expense)}</span>}
          accentClassName="text-rose-600 dark:text-rose-400"
          loading={loading}
          helperText={`Periode ${periodLabel}`}
        />
        <SummaryCard
          label="Saldo Cash"
          icon={<Wallet className="h-5 w-5" />}
          value={<span className="text-amber-600 dark:text-amber-400">{fmtIDR(cashBalance)}</span>}
          accentClassName="text-amber-600 dark:text-amber-400"
          loading={loading}
          footer={
            <div className="mt-3 border-t border-muted-foreground/20 pt-3">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide">
                <span className="flex items-center gap-2 text-[0.8rem] text-sky-600 dark:text-sky-400">
                  <CreditCard className="h-4 w-4" /> Non-Cash
                </span>
                <span className="text-base font-semibold text-sky-600 dark:text-sky-400">
                  {loading ? <SkeletonValue /> : fmtIDR(nonCashBalance)}
                </span>
              </div>
            </div>
          }
        />
        <SummaryCard
          label="Total Saldo"
          icon={<Banknote className="h-5 w-5" />}
          value={<span className="text-primary">{fmtIDR(totalBalance)}</span>}
          loading={loading}
          footer={
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
                    netPositive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  )}
                >
                  {netPositive ? (
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                  )}
                  Net {fmtIDR(Math.abs(net))}
                </span>
                <span className="text-xs text-muted-foreground">vs periode</span>
              </div>
              <Sparkline data={netTrend} loading={loading} />
            </div>
          }
        />
      </div>
    </section>
  );
}
