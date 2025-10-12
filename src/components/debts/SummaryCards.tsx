import type { CSSProperties } from 'react';

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
    accent: 'hsl(346 77% 47% / 0.65)',
  },
  {
    key: 'debtDueThisMonth' as const,
    label: 'Hutang Bulan Ini',
    description: 'Total hutang jatuh tempo di bulan berjalan',
    tone: 'text-orange-400 dark:text-orange-300',
    accent: 'hsl(27 96% 55% / 0.65)',
  },
  {
    key: 'totalReceivable' as const,
    label: 'Total Piutang',
    description: 'Tagihan yang perlu ditagih',
    tone: 'text-emerald-400 dark:text-emerald-300',
    accent: 'hsl(152 76% 40% / 0.65)',
  },
  {
    key: 'totalPaidThisMonth' as const,
    label: 'Terbayar Bulan Ini',
    description: 'Akumulasi cicilan tercatat bulan ini',
    tone: 'text-sky-400 dark:text-sky-300',
    accent: 'hsl(199 89% 48% / 0.65)',
  },
] satisfies {
  key: keyof DebtSummary;
  label: string;
  description: string;
  tone: string;
  accent: string;
}[];

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => {
        const value = summary ? summary[card.key] : 0;
        const gradientOverlayStyle: CSSProperties = {
          backgroundImage: `radial-gradient(120% 120% at 0% 0%, ${card.accent} 0%, transparent 70%), radial-gradient(120% 120% at 100% 100%, ${card.accent} 0%, transparent 70%)`,
        };
        return (
          <article
            key={card.key}
            className="card relative min-w-0 overflow-hidden border border-border/60 bg-surface-1/90 p-4 text-left md:p-5"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 opacity-70 mix-blend-screen"
              style={gradientOverlayStyle}
            />
            <div className="relative z-[1] space-y-2">
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
