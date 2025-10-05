import clsx from 'clsx';

interface WeeklyPickerOption {
  value: string;
  label: string;
}

interface WeeklyPickerProps {
  options: WeeklyPickerOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function WeeklyPicker({ options, value, onChange }: WeeklyPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={clsx(
          'inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          value === 'all'
            ? 'border-transparent bg-[color:var(--accent)] text-white shadow'
            : 'border-border/60 bg-surface/80 text-muted hover:text-text'
        )}
        aria-label="Tampilkan semua minggu"
      >
        Semua minggu
      </button>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              active
                ? 'border-transparent bg-[color:var(--accent)] text-white shadow'
                : 'border-border/60 bg-surface/80 text-muted hover:text-text'
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
