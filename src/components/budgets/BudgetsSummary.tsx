import type { BudgetSummary } from '../../lib/api-budgets';
import { formatBudgetAmount } from '../../lib/api-budgets';

interface BudgetsSummaryProps {
  summary: BudgetSummary;
  loading?: boolean;
}

const CARDS = [
  { key: 'planned', label: 'Total Anggaran' },
  { key: 'actual', label: 'Aktual' },
  { key: 'remaining', label: 'Sisa' },
  { key: 'overspend', label: 'Overspend' },
] as const;

export default function BudgetsSummary({ summary, loading }: BudgetsSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const value = summary[card.key];
        const isNegative = value < 0;
        return (
          <div
            key={card.key}
            className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm"
          >
            <p className="text-sm text-muted">{card.label}</p>
            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${
                isNegative ? 'text-red-500' : ''
              }`}
            >
              {loading ? '…' : formatBudgetAmount(value)}
            </p>
          </div>
        );
      })}
      <div className="rounded-2xl border border-dashed border-border bg-surface-1 p-4">
        <p className="text-sm text-muted">Coverage Days</p>
        <p className="mt-2 text-lg font-medium">
          {loading
            ? '…'
            : summary.coverageDays != null
            ? `${summary.coverageDays} hari`
            : '—'}
        </p>
        <p className="mt-1 text-xs text-muted">
          Estimasi berapa lama sisa anggaran bertahan dengan pola pengeluaran saat ini.
        </p>
      </div>
    </div>
  );
}
