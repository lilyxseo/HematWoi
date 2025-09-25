import { useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import { formatRangeLabel, type DateRange } from '../../lib/date-range';

const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

interface DashboardSummaryProps {
  income: number;
  expense: number;
  cashBalance: number;
  nonCashBalance: number;
  totalBalance: number;
  period: DateRange;
  loading?: boolean;
  error?: string | null;
}

function formatCurrency(value: number, { allowNegative = false }: { allowNegative?: boolean } = {}) {
  const numeric = Number.isFinite(value) ? Math.trunc(value) : 0;
  const adjusted = allowNegative ? numeric : Math.max(0, numeric);
  return CURRENCY_FORMATTER.format(adjusted);
}

function buildSparklinePath(income: number, expense: number): string {
  const net = income - expense;
  const values = [
    income * 0.25,
    income * 0.35 - expense * 0.15,
    income * 0.45 - expense * 0.2,
    net,
    net * 0.85,
    net * 1.05,
  ];
  if (values.every((v) => !Number.isFinite(v) || v === 0)) {
    return '0,18 20,18 40,18 60,18 80,18 100,18';
  }
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const spread = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const normalized = (value - min) / spread;
      const y = 26 - normalized * 18;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function SummaryValue({ label, value, loading, className }: { label: string; value: string; loading?: boolean; className?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <div className="h-7 w-28 rounded-full bg-muted/40 dark:bg-zinc-800/50 animate-pulse" />
      ) : (
        <p className={clsx('text-2xl font-bold tracking-tight md:text-3xl', className)}>{value}</p>
      )}
    </div>
  );
}

export default function DashboardSummary({
  income,
  expense,
  cashBalance,
  nonCashBalance,
  totalBalance,
  period,
  loading = false,
  error = null,
}: DashboardSummaryProps) {
  const periodLabel = useMemo(() => formatRangeLabel(period.start, period.end), [period.end, period.start]);
  const net = income - expense;
  const netPositive = net >= 0;
  const netLabel = netPositive ? 'Naik' : 'Turun';
  const netClass = netPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const sparklinePath = useMemo(() => buildSparklinePath(income, expense), [income, expense]);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-transparent bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm backdrop-blur transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
          <div className="flex items-start justify-between">
            <SummaryValue
              label={`Pemasukan · ${periodLabel}`}
              value={formatCurrency(income)}
              loading={loading}
              className="text-emerald-600 dark:text-emerald-400"
            />
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center" title="Total pemasukan periode ini">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-transparent bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm backdrop-blur transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
          <div className="flex items-start justify-between">
            <SummaryValue
              label={`Pengeluaran · ${periodLabel}`}
              value={formatCurrency(expense)}
              loading={loading}
              className="text-rose-600 dark:text-rose-400"
            />
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400" title="Total pengeluaran periode ini">
              <TrendingDown className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-transparent bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm backdrop-blur transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
          <div className="flex items-start justify-between">
            <div className="space-y-4">
              <SummaryValue
                label="Saldo Cash"
                value={formatCurrency(cashBalance, { allowNegative: true })}
                loading={loading}
                className="text-amber-600 dark:text-amber-400"
              />
              <div className="border-t border-border/60 pt-3">
                <SummaryValue
                  label="Saldo Non-Cash"
                  value={formatCurrency(nonCashBalance, { allowNegative: true })}
                  loading={loading}
                  className="text-sky-600 dark:text-sky-400"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2" aria-hidden="true">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400" title="Saldo akun cash">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400" title="Saldo akun non-cash">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-transparent bg-gradient-to-b from-white/80 to-white/40 p-5 shadow-sm backdrop-blur transition hover:border-primary/20 hover:shadow-md dark:from-zinc-900/60 dark:to-zinc-900/30">
          <div className="flex items-start justify-between">
            <SummaryValue label="Total Saldo" value={formatCurrency(totalBalance, { allowNegative: true })} loading={loading} />
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary" title="Total saldo akun">
              <Banknote className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium', netClass)}>
              {netPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              Net {formatCurrency(net, { allowNegative: true })}
            </span>
            <span className="text-xs text-muted-foreground">{netLabel} dibanding pengeluaran</span>
          </div>
          {loading ? (
            <div className="mt-4 h-12 w-full animate-pulse rounded-xl bg-muted/40 dark:bg-zinc-800/50" aria-hidden="true" />
          ) : (
            <svg className="mt-4 h-12 w-full text-primary/70" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label="Netto bulan ini">
              <polyline points={sparklinePath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </article>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200/60 bg-rose-50/80 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}
    </section>
  );
}
