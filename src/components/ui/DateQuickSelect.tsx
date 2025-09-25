import { useId } from 'react';
import clsx from 'clsx';

export type DateQuickSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
};

function formatDateForOffset(offset: number): string {
  const now = new Date();
  now.setDate(now.getDate() + offset);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

export function getTodayJakarta(): string {
  return formatDateForOffset(0);
}

export function getYesterdayJakarta(): string {
  return formatDateForOffset(-1);
}

const DateQuickSelect = ({ label, value, onChange, disabled, error }: DateQuickSelectProps) => {
  const id = useId();
  const today = getTodayJakarta();
  const yesterday = getYesterdayJakarta();

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
          {[
            { label: 'Hari ini', date: today },
            { label: 'Kemarin', date: yesterday },
          ].map((item) => (
            <button
              key={item.date}
              type="button"
              onClick={() => onChange(item.date)}
              disabled={disabled}
              data-active={value === item.date}
              className={clsx(
                'px-3 h-9 rounded-xl text-sm font-medium transition data-[active=true]:bg-primary data-[active=true]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            id={id}
            type="date"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 dark:border-zinc-700/70 dark:bg-zinc-900/60"
          />
        </div>
      </div>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
};

export default DateQuickSelect;
