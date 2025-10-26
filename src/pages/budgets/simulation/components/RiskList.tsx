import type { RiskItem } from '../../../../lib/simScenarioApi';

interface RiskListProps {
  loading: boolean;
  risks: RiskItem[];
}

const LEVEL_STYLES: Record<RiskItem['level'], { label: string; className: string }> = {
  info: { label: 'Stabil', className: 'bg-[color:var(--accent)]/10 text-[color:var(--accent)]' },
  watch: { label: 'Perlu perhatian', className: 'bg-amber-400/10 text-amber-400' },
  warning: { label: 'Risiko tinggi', className: 'bg-orange-500/10 text-orange-500' },
  critical: { label: 'Over', className: 'bg-rose-500/10 text-rose-500' },
};

const numberFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return numberFormatter.format(Math.round(value ?? 0));
}

export default function RiskList({ loading, risks }: RiskListProps): JSX.Element {
  if (loading) {
    return (
      <div className="space-y-3 p-6" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl bg-border/40" />
        ))}
      </div>
    );
  }

  if (risks.length === 0) {
    return (
      <div className="p-6 text-sm text-muted">
        Tidak ada kategori dengan risiko over-budget. Pertahankan performa yang baik!
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-sm font-semibold text-text">Risiko Over-Budget</h2>
      <ul className="space-y-3">
        {risks.map((risk) => {
          const style = LEVEL_STYLES[risk.level];
          const percentage = Math.round(risk.ratio * 100);
          return (
            <li
              key={risk.categoryId}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface/80 px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-semibold text-text">{risk.name}</p>
                <p className="text-xs text-muted">
                  Planned {formatCurrency(risk.planned)} · Projected {formatCurrency(risk.projected)}
                </p>
              </div>
              <span
                className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold ${style.className}`}
                aria-label={`Risiko ${style.label}`}
              >
                {style.label} · {percentage}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

