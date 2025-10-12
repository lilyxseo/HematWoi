interface ProgressTinyProps {
  value: number
  tone?: 'accent' | 'amber' | 'rose'
  'aria-hidden'?: boolean
}

const COLORS: Record<NonNullable<ProgressTinyProps['tone']>, string> = {
  accent: 'var(--accent)',
  amber: '#f59e0b',
  rose: '#f43f5e',
}

export default function ProgressTiny({ value, tone = 'accent', 'aria-hidden': ariaHidden }: ProgressTinyProps) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(value, 2)) : 0
  const percent = `${(clamped * 100).toFixed(0)}%`
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/40" aria-hidden={ariaHidden}>
      <div
        className="h-full rounded-full transition-all"
        style={{
          width: percent,
          backgroundColor: COLORS[tone],
        }}
      />
    </div>
  )
}
