import type { Insight } from '../hooks/useInsights';

const TYPE_ICON: Record<Insight['type'], string> = {
  trend: '📈',
  budget: '💸',
  good: '😎',
  warn: '🚨',
  subs: '📅',
  goal: '🎯',
};

const TYPE_LABEL: Record<Insight['type'], string> = {
  trend: 'Tren',
  budget: 'Anggaran',
  good: 'Kabar Baik',
  warn: 'Peringatan',
  subs: 'Langganan',
  goal: 'Target',
};

const SEVERITY_STYLE = {
  high: {
    border: 'border-rose-500/60 dark:border-rose-400/60',
    background: 'bg-rose-500/10 dark:bg-rose-400/10',
    badge: 'text-rose-700 dark:text-rose-100',
    label: 'Gawat',
  },
  med: {
    border: 'border-amber-500/60 dark:border-amber-400/60',
    background: 'bg-amber-400/15 dark:bg-amber-400/10',
    badge: 'text-amber-700 dark:text-amber-100',
    label: 'Waspada',
  },
  low: {
    border: 'border-emerald-500/50 dark:border-emerald-400/50',
    background: 'bg-emerald-400/15 dark:bg-emerald-400/10',
    badge: 'text-emerald-700 dark:text-emerald-100',
    label: 'Santuy',
  },
} as const;

interface InsightCardProps {
  insight: Insight;
}

export default function InsightCard({ insight }: InsightCardProps) {
  const icon = TYPE_ICON[insight.type] ?? '💡';
  const typeLabel = TYPE_LABEL[insight.type] ?? 'Insight';
  const style = SEVERITY_STYLE[insight.severity];

  return (
    <article
      className={`flex h-full flex-col justify-between rounded-xl border ${style.border} ${style.background} p-4 text-sm shadow-sm transition-colors`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-2xl leading-none">
            {icon}
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {typeLabel}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wide ${style.badge}`}>
              {style.label}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-text">{insight.message}</p>
      {insight.meta?.hint ? (
        <p className="mt-2 text-xs text-muted">{String(insight.meta.hint)}</p>
      ) : null}
    </article>
  );
}
