import clsx from 'clsx';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatDate(offset: number): string {
  const base = new Date();
  const shifted = new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
  return formatter.format(shifted);
}

type DateChipsProps = {
  value: string;
  onSelect: (next: string) => void;
};

export function DateChips({ value, onSelect }: DateChipsProps) {
  const todayValue = formatDate(0);
  const yesterdayValue = formatDate(-1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        data-active={value === todayValue}
        onClick={() => onSelect(todayValue)}
        className={clsx(
          'h-9 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'bg-muted/40 hover:bg-muted/60 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
        )}
      >
        Hari ini
      </button>
      <button
        type="button"
        data-active={value === yesterdayValue}
        onClick={() => onSelect(yesterdayValue)}
        className={clsx(
          'h-9 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'bg-muted/40 hover:bg-muted/60 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
        )}
      >
        Kemarin
      </button>
    </div>
  );
}

export default DateChips;
