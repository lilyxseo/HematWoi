import clsx from "clsx";
import MonthPicker from "./MonthPicker";

interface PeriodToolbarProps {
  mode: "single" | "range";
  singleMonth: string;
  rangeStart: string;
  rangeEnd: string;
  onModeChange: (mode: "single" | "range") => void;
  onSingleMonthChange: (value: string) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  className?: string;
}

export default function PeriodToolbar({
  mode,
  singleMonth,
  rangeStart,
  rangeEnd,
  onModeChange,
  onSingleMonthChange,
  onRangeStartChange,
  onRangeEndChange,
  className,
}: PeriodToolbarProps) {
  return (
    <div
      className={clsx(
        "flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:items-center md:justify-end",
        className
      )}
    >
      <div className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 p-1 text-sm font-medium text-white/70 md:w-auto">
        <button
          type="button"
          onClick={() => onModeChange("single")}
          className={clsx(
            "flex-1 rounded-full px-3 py-2 text-sm font-medium transition md:flex-none",
            mode === "single"
              ? "border border-primary/30 bg-gradient-to-r from-primary/25 to-primary/10 text-white shadow-sm"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          )}
        >
          Per Bulan
        </button>
        <button
          type="button"
          onClick={() => onModeChange("range")}
          className={clsx(
            "flex-1 rounded-full px-3 py-2 text-sm font-medium transition md:flex-none",
            mode === "range"
              ? "border border-primary/30 bg-gradient-to-r from-primary/25 to-primary/10 text-white shadow-sm"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          )}
        >
          Rentang Bulan
        </button>
      </div>

      {mode === "single" ? (
        <div className="w-full md:w-72">
          <MonthPicker label="Bulan" value={singleMonth} onChange={onSingleMonthChange} />
        </div>
      ) : (
        <div className="grid w-full gap-2 md:w-[420px] md:grid-cols-2">
          <MonthPicker label="Mulai" value={rangeStart} onChange={onRangeStartChange} />
          <MonthPicker label="Sampai" value={rangeEnd} onChange={onRangeEndChange} />
        </div>
      )}
    </div>
  );
}
