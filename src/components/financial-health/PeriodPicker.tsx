import { Calendar } from "lucide-react";

interface PeriodPickerProps {
  mode: "single" | "range";
  singleMonth: string;
  rangeStart: string;
  rangeEnd: string;
  onSingleMonthChange: (value: string) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
}

export default function PeriodPicker({
  mode,
  singleMonth,
  rangeStart,
  rangeEnd,
  onSingleMonthChange,
  onRangeStartChange,
  onRangeEndChange,
}: PeriodPickerProps) {
  const inputClass =
    "h-10 w-full rounded-xl border border-white/10 bg-card/40 px-3 pr-10 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <div className="flex w-full flex-wrap items-end gap-3">
      {mode === "single" ? (
        <label className="flex w-full flex-col gap-1 text-xs text-muted">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Bulan
          </span>
          <div className="relative">
            <input
              type="month"
              value={singleMonth}
              onChange={(event) => onSingleMonthChange(event.target.value)}
              className={inputClass}
            />
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        </label>
      ) : (
        <div className="grid w-full gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Mulai
            </span>
            <div className="relative">
              <input
                type="month"
                value={rangeStart}
                onChange={(event) => onRangeStartChange(event.target.value)}
                className={inputClass}
              />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Sampai
            </span>
            <div className="relative">
              <input
                type="month"
                value={rangeEnd}
                onChange={(event) => onRangeEndChange(event.target.value)}
                className={inputClass}
              />
              <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </label>
        </div>
      )}
    </div>
  );
}
