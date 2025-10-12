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
    accentRgb: '244 114 182',
  },
  {
    key: 'debtDueThisMonth' as const,
    label: 'Hutang Bulan Ini',
    description: 'Total hutang jatuh tempo di bulan berjalan',
    tone: 'text-orange-400 dark:text-orange-300',
    accentRgb: '251 146 60',
  },
  {
    key: 'totalReceivable' as const,
    label: 'Total Piutang',
    description: 'Tagihan yang perlu ditagih',
    tone: 'text-emerald-400 dark:text-emerald-300',
    accentRgb: '52 211 153',
  },
  {
    key: 'totalPaidThisMonth' as const,
    label: 'Terbayar Bulan Ini',
    description: 'Akumulasi cicilan tercatat bulan ini',
    tone: 'text-sky-400 dark:text-sky-300',
    accentRgb: '56 189 248',
  },
] satisfies {
  key: keyof DebtSummary;
  label: string;
  description: string;
  tone: string;
  accentRgb: string;
}[];

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => {
        const value = summary ? summary[card.key] : 0;
        return (
          <article
            key={card.key}
            className="relative min-w-0 overflow-hidden rounded-[1.75rem] p-[1px]"
            style={{
              backgroundImage: `linear-gradient(135deg, rgb(${card.accentRgb} / 0.55), rgb(${card.accentRgb} / 0.08) 55%, transparent)`,
            }}
          >
            <div className="card min-w-0 space-y-2 border border-border/60 bg-surface-1/95 text-left md:p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {card.label}
              </p>
              <p className={`text-xl font-bold tracking-tight tabular-nums md:text-2xl ${card.tone}`}>
                {formatCurrency(value)}
              </p>
              <p className="text-xs text-muted">{card.description}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
