import type { BadgeRecord } from '../lib/achievements';

const ICONS: Record<string, string> = {
  STREAK_7: '🔥',
  BUDGET_OK_1M: '🛡️',
  SAVE_1M: '💰',
  NO_EATOUT_14: '🥗',
  IMPORT_100: '📥',
};

function formatEarnedDate(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

interface BadgeProps {
  badge: BadgeRecord;
}

export default function Badge({ badge }: BadgeProps) {
  const icon = ICONS[badge.code] ?? '🏅';
  const earned = formatEarnedDate(badge.earned_at);

  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm backdrop-blur transition hover:border-brand/40"
      title={`Diperoleh ${earned}`}
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">{badge.title}</p>
        <p className="text-xs text-muted/80">Diperoleh {earned}</p>
      </div>
    </div>
  );
}
