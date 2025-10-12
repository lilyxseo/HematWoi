import clsx from 'clsx';

export type ProgressTone = 'accent' | 'amber' | 'rose' | 'neutral';

interface ProgressTinyProps {
  value: number;
  tone?: ProgressTone;
  ariaLabel?: string;
}

const TONE_CLASSES: Record<ProgressTone, string> = {
  accent: 'bg-brand',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  neutral: 'bg-muted-foreground/50',
};

export function ProgressTiny({ value, tone = 'accent', ariaLabel }: ProgressTinyProps) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(value * 100, 200)) : 0;
  return (
    <div className="mt-1" aria-hidden={ariaLabel ? undefined : true} aria-label={ariaLabel}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60 dark:bg-border/40">
        <div
          className={clsx('h-full rounded-full transition-all duration-500 ease-out', TONE_CLASSES[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressTiny;
