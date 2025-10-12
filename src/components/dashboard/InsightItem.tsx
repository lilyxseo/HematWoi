import clsx from 'clsx';
import type { ReactNode } from 'react';

export type InsightTone = 'accent' | 'amber' | 'rose' | 'neutral';

interface InsightBadge {
  label: string;
  tone?: InsightTone;
  tooltip?: string;
}

interface InsightItemProps {
  icon: ReactNode;
  title: string;
  description?: string;
  meta?: string;
  badge?: InsightBadge | null;
  onClick?: () => void;
  ariaLabel?: string;
  children?: ReactNode;
}

const BADGE_CLASS: Record<InsightTone, string> = {
  accent: 'bg-brand/10 text-brand dark:bg-brand/20',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100',
  rose: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100',
  neutral: 'bg-muted/50 text-muted-foreground dark:bg-muted/20',
};

export default function InsightItem({
  icon,
  title,
  description,
  meta,
  badge,
  onClick,
  ariaLabel,
  children,
}: InsightItemProps) {
  const Component = onClick ? 'button' : 'div';
  const content = (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'group relative flex min-h-[3.25rem] w-full items-start gap-3 rounded-2xl border border-border/60 bg-surface-1/70 p-3 text-left shadow-sm transition',
        'hover:border-border-strong/80 hover:bg-surface-1/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] focus-visible:ring-offset-2'
      )}
      aria-label={ariaLabel}
    >
      <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start gap-2">
          <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
          {badge ? (
            <span
              className={clsx(
                'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide transition',
                BADGE_CLASS[badge.tone ?? 'accent']
              )}
              title={badge.tooltip}
            >
              {badge.label}
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="text-xs text-muted-foreground/90">{description}</span>
        ) : null}
        {children}
        {meta ? <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground/80">{meta}</span> : null}
      </span>
    </Component>
  );

  return content;
}
