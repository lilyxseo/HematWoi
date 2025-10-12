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
    accent: {
      light: '244 63 94',
      dark: '251 113 133',
    },
  },
  {
    key: 'debtDueThisMonth' as const,
    label: 'Hutang Bulan Ini',
    description: 'Total hutang jatuh tempo di bulan berjalan',
    tone: 'text-orange-400 dark:text-orange-300',
    accent: {
      light: '249 115 22',
      dark: '253 186 116',
    },
  },
  {
    key: 'totalReceivable' as const,
    label: 'Total Piutang',
    description: 'Tagihan yang perlu ditagih',
    tone: 'text-emerald-400 dark:text-emerald-300',
    accent: {
      light: '16 185 129',
      dark: '110 231 183',
    },
  },
  {
    key: 'totalPaidThisMonth' as const,
    label: 'Terbayar Bulan Ini',
    description: 'Akumulasi cicilan tercatat bulan ini',
    tone: 'text-sky-400 dark:text-sky-300',
    accent: {
      light: '14 165 233',
      dark: '56 189 248',
    },
  },
] satisfies {
  key: keyof DebtSummary;
  label: string;
  description: string;
  tone: string;
  accent: {
    light: string;
    dark: string;
  };
}[];

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map((card) => {
        const value = summary ? summary[card.key] : 0;
        return (
          <article
            key={card.key}
            className="card accent-card min-w-0 space-y-2 border border-border/60 bg-surface-1/90 p-4 text-left md:p-5"
            style={{
              '--card-accent': card.accent.light,
              '--card-accent-dark': card.accent.dark,
            } as CSSProperties}
          >
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
