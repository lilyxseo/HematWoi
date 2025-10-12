import type { ReactNode } from 'react';
import clsx from 'clsx';

interface InsightBadgeProps {
  label: string;
  tone?: 'accent' | 'amber' | 'rose' | 'neutral';
  tooltip?: string;
}

interface InsightItemProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  badge?: InsightBadgeProps;
  progress?: number;
  onClick?: () => void;
  ariaLabel?: string;
}

function toneClass(tone: InsightBadgeProps['tone']): string {
  switch (tone) {
    case 'amber':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200';
    case 'rose':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200';
    case 'neutral':
      return 'bg-muted/40 text-muted-foreground';
    default:
      return 'bg-[color:var(--accent-bg,theme(colors.sky.100))] text-[color:var(--accent,theme(colors.sky.700))] dark:bg-[color:var(--accent)/25] dark:text-[color:var(--accent,theme(colors.sky.200))]';
  }
}

function toneRingClass(tone: InsightBadgeProps['tone']): string {
  switch (tone) {
    case 'amber':
      return 'text-amber-500 bg-amber-500/10';
    case 'rose':
      return 'text-rose-500 bg-rose-500/10';
    default:
      return 'text-[color:var(--accent,theme(colors.sky.600))] bg-[color:var(--accent-bg,theme(colors.sky.100))] dark:bg-[color:var(--accent)/15]';
  }
}

function clampProgress(value?: number): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(value, 1));
}

export function ProgressTiny({ value, tone }: { value: number; tone: InsightBadgeProps['tone'] }) {
  const normalized = clampProgress(value);
  const indicatorClass =
    tone === 'rose'
      ? 'bg-rose-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : 'bg-[color:var(--accent,theme(colors.indigo.500))]';
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-muted/30">
      <div className={clsx('h-full rounded-full transition-all', indicatorClass)} style={{ width: `${Math.round(normalized * 100)}%` }} />
    </div>
  );
}

export default function InsightItem({
  icon,
  title,
  subtitle,
  value,
  badge,
  progress,
  onClick,
  ariaLabel,
}: InsightItemProps) {
  const content = (
    <div className="flex w-full items-center gap-3">
      <span
        className={clsx(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base transition',
          toneRingClass(badge?.tone)
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {value ? <p className="text-sm font-semibold text-foreground">{value}</p> : null}
        </div>
        {progress != null ? <ProgressTiny value={progress} tone={badge?.tone} /> : null}
      </div>
      {badge ? (
        <span
          className={clsx(
            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition',
            toneClass(badge.tone)
          )}
          title={badge.tooltip}
        >
          {badge.label}
        </span>
      ) : null}
    </div>
  );

  if (!onClick) {
    return <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm dark:border-border/40">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? title}
      className="group w-full rounded-2xl border border-border/60 bg-card/70 p-3 text-left shadow-sm transition hover:border-[color:var(--accent)]/60 hover:bg-[color:var(--accent)/8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,theme(colors.indigo.500))] dark:border-border/40"
    >
      {content}
    </button>
  );
}
