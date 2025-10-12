import type { DebtSummary } from '../../lib/api-debts';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatCurrency(value?: number | null) {
  return currencyFormatter.format(Math.max(0, Number(value ?? 0)));
}

interface SummaryCardsProps {
  summary: DebtSummary | null;
}

const CARDS = [
  {
    key: 'totalDebt' as const,
    label: 'Total Hutang',
    description: 'Jumlah kewajiban yang belum terbayar',
    tone: 'text-rose-400 dark:text-rose-300',
    edgeGradient:
      'from-transparent via-rose-400/60 to-transparent dark:via-rose-300/60 dark:from-transparent dark:to-transparent',
  },
  {
    key: 'debtDueThisMonth' as const,
    label: 'Hutang Bulan Ini',
    description: 'Total hutang jatuh tempo di bulan berjalan',
    tone: 'text-orange-400 dark:text-orange-300',
    edgeGradient:
      'from-transparent via-orange-400/60 to-transparent dark:via-orange-300/60 dark:from-transparent dark:to-transparent',
  },
  {
    key: 'totalReceivable' as const,
    label: 'Total Piutang',
    description: 'Tagihan yang perlu ditagih',
    tone: 'text-emerald-400 dark:text-emerald-300',
    edgeGradient:
      'from-transparent via-emerald-400/60 to-transparent dark:via-emerald-300/60 dark:from-transparent dark:to-transparent',
  },
  {
    key: 'totalPaidThisMonth' as const,
    label: 'Terbayar Bulan Ini',
    description: 'Akumulasi cicilan tercatat bulan ini',
    tone: 'text-sky-400 dark:text-sky-300',
    edgeGradient:
      'from-transparent via-sky-400/60 to-transparent dark:via-sky-300/60 dark:from-transparent dark:to-transparent',
  },
] satisfies {
  key: keyof DebtSummary;
  label: string;
  description: string;
  tone: string;
  edgeGradient: string;
}[];

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => {
        const value = summary ? summary[card.key] : 0;
        return (
          <article
            key={card.key}
            className="card relative min-w-0 space-y-2 overflow-hidden border border-border/60 bg-surface-1/90 p-4 text-left md:p-5"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b ${card.edgeGradient}`}
            />
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-gradient-to-b ${card.edgeGradient}`}
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {card.label}
            </p>
            <p className={`text-xl font-bold tracking-tight tabular-nums md:text-2xl ${card.tone}`}>
              {formatCurrency(value)}
            </p>
            <p className="text-xs text-muted">{card.description}</p>
          </article>
        );
      })}
    </section>
  );
}
