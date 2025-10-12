import clsx from 'clsx'

interface ProgressTinyProps {
  value: number
  tone?: 'default' | 'warning' | 'danger' | 'accent'
  className?: string
}

const toneClassMap: Record<NonNullable<ProgressTinyProps['tone']>, string> = {
  default: 'bg-[color:var(--accent)]',
  accent: 'bg-[color:var(--accent)]',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
}

export default function ProgressTiny({ value, tone = 'default', className }: ProgressTinyProps) {
  const clamped = Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0
  return (
    <div className={clsx('mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border-subtle/70', className)} aria-hidden="true">
      <div
        className={clsx('h-full rounded-full transition-all duration-300 ease-out', toneClassMap[tone] ?? toneClassMap.default)}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
