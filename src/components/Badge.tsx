import type { FC } from 'react';

interface BadgeProps {
  title: string;
  description: string;
  emoji: string;
  earnedAt?: string | null;
}

const Badge: FC<BadgeProps> = ({ title, description, emoji, earnedAt }) => {
  const earned = Boolean(earnedAt);
  const earnedLabel = earnedAt
    ? new Date(earnedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Belum diraih';

  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-2xl border px-3 py-2 text-left transition-colors sm:px-4 sm:py-3 ${
        earned ? 'border-emerald-300/60 bg-emerald-500/10 dark:border-emerald-500/40' : 'border-border bg-muted/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl sm:text-2xl" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</p>
          <p className="text-xs text-muted-foreground">{earnedLabel}</p>
        </div>
        <span
          className={`ml-auto rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide ${
            earned ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground'
          }`}
        >
          {earned ? 'Diraih' : 'Belum'}
        </span>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">{description}</p>
      <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 hidden translate-y-[-6px] px-2 pb-2 group-hover:block">
        <div className="rounded-xl border border-border/70 bg-popover px-3 py-2 text-[11px] text-muted-foreground shadow-lg">
          {description}
        </div>
      </div>
    </div>
  );
};

export default Badge;
