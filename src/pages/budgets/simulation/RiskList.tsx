import { formatCurrency } from '../../../lib/format';
import type { RiskEntry } from '../../../lib/simMath';

interface RiskListProps {
  risks: RiskEntry[];
}

function getLevelClasses(level: RiskEntry['level']): string {
  switch (level) {
    case 'accent':
      return 'bg-[color:var(--accent-100)] text-[color:var(--accent-700)]';
    case 'amber':
      return 'bg-amber-500/10 text-amber-500';
    case 'orange':
      return 'bg-orange-500/10 text-orange-500';
    case 'rose':
    default:
      return 'bg-rose-500/10 text-rose-500';
  }
}

export default function RiskList({ risks }: RiskListProps) {
  if (!risks.length) {
    return (
      <div className="rounded-3xl border border-border/60 bg-surface/80 p-5 text-sm text-muted shadow-sm">
        Tidak ada kategori berisiko tinggi saat ini. 🎉
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-text">Risiko Over-Budget</h3>
      <p className="text-xs text-muted">Kategori dengan proyeksi ≥ 90% dari target simulasi.</p>
      <ul className="mt-4 space-y-3">
        {risks
          .slice()
          .sort((a, b) => b.ratio - a.ratio)
          .map((risk) => (
            <li key={risk.categoryId} className="flex items-center justify-between gap-3 rounded-2xl bg-surface/60 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-text">{risk.categoryName}</span>
                <span className="text-xs text-muted">
                  Proyeksi {formatCurrency(risk.projected, 'IDR')} dari target {formatCurrency(risk.planned, 'IDR')}
                </span>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getLevelClasses(risk.level)}`}>
                {(risk.ratio * 100).toFixed(0)}%
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

