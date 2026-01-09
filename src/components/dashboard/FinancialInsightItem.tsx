import clsx from 'clsx'
import type { ReactNode } from 'react'
import ProgressTiny from './ProgressTiny'

export type InsightTone = 'default' | 'info' | 'accent' | 'warning' | 'danger'

export interface InsightBadge {
  label: string
  tone?: InsightTone
  tooltip?: string
}

interface FinancialInsightItemProps {
  icon: ReactNode
  title: string
  subtitle?: string
  badge?: InsightBadge
  onClick?: () => void
  tone?: InsightTone
  ariaLabel?: string
  progress?: number
  disabled?: boolean
}

const toneRingMap: Record<InsightTone, string> = {
  default: 'ring-transparent hover:bg-surface-alt/70',
  info: 'ring-transparent hover:bg-[color:var(--accent-muted)]/40',
  accent: 'ring-transparent hover:bg-[color:var(--accent-muted)]/40',
  warning: 'ring-amber-500/40 hover:bg-amber-500/10',
  danger: 'ring-rose-500/50 hover:bg-rose-500/10',
}

const toneSurfaceMap: Record<InsightTone, string> = {
  default: 'bg-card/60',
  info: 'bg-[color:var(--accent-muted)]/25',
  accent: 'bg-[color:var(--accent-muted)]/25',
  warning: 'bg-amber-500/10',
  danger: 'bg-rose-500/10',
}

const toneIconMap: Record<InsightTone, string> = {
  default: 'bg-surface-alt',
  info: 'bg-[color:var(--accent-muted)]/60 text-[color:var(--accent-dark)]',
  accent: 'bg-[color:var(--accent-muted)]/60 text-[color:var(--accent-dark)]',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  danger: 'bg-rose-500/15 text-rose-500 dark:text-rose-300',
}

const badgeToneMap: Record<InsightTone, string> = {
  default: 'bg-border text-text',
  info: 'bg-[color:var(--accent-muted)] text-[color:var(--accent-dark)]',
  accent: 'bg-[color:var(--accent-muted)] text-[color:var(--accent-dark)]',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  danger: 'bg-rose-500/15 text-rose-500 dark:text-rose-300',
}

export default function FinancialInsightItem({
  icon,
  title,
  subtitle,
  badge,
  onClick,
  tone = 'default',
  ariaLabel,
  progress,
  disabled = false,
}: FinancialInsightItemProps) {
  const buttonTone = toneRingMap[tone] ?? toneRingMap.default
  const badgeTone = badgeToneMap[badge?.tone ?? tone] ?? badgeToneMap.default
  const surfaceTone = toneSurfaceMap[tone] ?? toneSurfaceMap.default
  const iconTone = toneIconMap[tone] ?? toneIconMap.default

  const content = (
    <span className="flex min-h-[48px] flex-1 items-start gap-3 text-left">
      <span
        className={clsx(
          'mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-border-subtle',
          iconTone
        )}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="flex items-start gap-2">
          <span className="flex-1 text-sm font-medium text-text">{title}</span>
          {badge?.label ? (
            <span
              className={clsx('inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold', badgeTone)}
              title={badge?.tooltip}
            >
              {badge.label}
            </span>
          ) : null}
        </span>
        {subtitle ? <span className="mt-1 block text-xs text-muted-foreground">{subtitle}</span> : null}
        {typeof progress === 'number' ? (
          <ProgressTiny
            value={progress}
            tone={tone === 'warning' || tone === 'danger' ? tone : 'accent'}
            className="mt-2"
          />
        ) : null}
      </span>
    </span>
  )

  if (!onClick) {
    return (
      <div className={clsx('rounded-2xl border border-border-subtle/70 p-3', surfaceTone)}>{content}</div>
    )
  }

  return (
    <button
      type="button"
      className={clsx(
        'group flex w-full items-stretch rounded-2xl border border-border-subtle/70 p-3 text-left text-sm text-text shadow-sm transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        surfaceTone,
        buttonTone,
        disabled ? 'pointer-events-none opacity-60' : 'focus-visible:ring-[color:var(--brand-ring)]'
      )}
      onClick={onClick}
      aria-label={ariaLabel ?? title}
    >
      {content}
    </button>
  )
}

export function FinancialInsightItemSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border-subtle/70 bg-card/50 p-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-border/60" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/5 rounded-full bg-border/70" />
          <div className="h-3 w-3/5 rounded-full bg-border/60" />
        </div>
      </div>
    </div>
  )
}
