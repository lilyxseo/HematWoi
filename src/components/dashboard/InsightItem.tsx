import type { ReactNode } from 'react'
import clsx from 'clsx'
import ProgressTiny from './ProgressTiny'

export type InsightTone = 'accent' | 'amber' | 'rose' | 'muted'

interface InsightBadge {
  label: string
  tone?: InsightTone
  tooltip?: string
}

interface InsightItemProps {
  icon: ReactNode
  title: string
  subtitle?: string
  meta?: string
  badge?: InsightBadge
  progressValue?: number
  progressTone?: 'accent' | 'amber' | 'rose'
  onClick?: () => void
  ariaLabel?: string
}

const BADGE_COLORS: Record<InsightTone, string> = {
  accent: 'bg-[color:var(--accent)]/15 text-[color:var(--accent)]',
  amber: 'bg-amber-200/70 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200',
  rose: 'bg-rose-200/70 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  muted: 'bg-muted/40 text-muted-foreground',
}

export default function InsightItem({
  icon,
  title,
  subtitle,
  meta,
  badge,
  progressValue,
  progressTone = 'accent',
  onClick,
  ariaLabel,
}: InsightItemProps) {
  const badgeTone = badge?.tone ?? 'muted'
  const badgeClasses = BADGE_COLORS[badgeTone]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? title}
      className="group relative flex w-full items-start gap-4 rounded-2xl border border-border/60 bg-card/70 p-4 text-left shadow-sm transition hover:border-[color:var(--accent)]/40 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground transition group-hover:bg-[color:var(--accent)]/15 group-hover:text-[color:var(--accent)]">
        {icon}
      </span>
      <span className="flex min-h-[44px] flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground sm:text-base">{title}</span>
          {badge ? (
            <span
              className={clsx(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                badgeClasses,
              )}
              title={badge.tooltip}
            >
              {badge.label}
            </span>
          ) : null}
        </span>
        {subtitle ? <span className="text-sm text-muted-foreground">{subtitle}</span> : null}
        {meta ? <span className="text-xs font-medium text-muted-foreground/80">{meta}</span> : null}
        {typeof progressValue === 'number' ? (
          <div className="mt-2">
            <ProgressTiny value={progressValue} tone={progressTone} aria-hidden />
          </div>
        ) : null}
      </span>
    </button>
  )
}
