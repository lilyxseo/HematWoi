import type { SimulationRiskItem } from '../../../../lib/simMath';
import { formatCurrency, formatPercent, getRiskBadgeTone } from '../../../../lib/simMath';

interface RiskListProps {
  risks: SimulationRiskItem[];
}

export default function RiskList({ risks }: RiskListProps) {
  if (!risks.length) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 px-4 py-3 text-sm text-muted">
        Tidak ada kategori dengan risiko over-budget &gt;= 90%.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface-alt/70 p-4">
      <div>
        <h4 className="text-sm font-semibold text-text">Risiko Over-Budget</h4>
        <p className="text-xs text-muted">Kategori dengan proyeksi pengeluaran &gt;= 90% dari anggaran simulasi.</p>
      </div>
      <ul className="space-y-2">
        {risks.map((risk) => {
          const tone = getRiskBadgeTone(risk.progress);
          const badgeClass = tone === 'accent'
            ? 'bg-accent/20 text-accent'
            : tone === 'amber'
              ? 'bg-amber-500/20 text-amber-300'
              : tone === 'orange'
                ? 'bg-orange-500/20 text-orange-300'
                : 'bg-rose-500/20 text-rose-300';
          return (
            <li
              key={risk.categoryId}
              className="flex flex-col gap-1 rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm text-text sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-text">{risk.categoryName}</p>
                <p className="text-xs text-muted">Projected {formatCurrency(risk.projected)} vs Planned {formatCurrency(risk.planned)}</p>
              </div>
              <span className={`inline-flex h-7 min-w-[80px] items-center justify-center rounded-full px-3 text-xs font-semibold ${badgeClass}`}>
                {formatPercent(risk.progress)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
