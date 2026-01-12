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
}: PeriodToolbarProps) {
  return (
    <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center md:justify-end md:gap-3">
      <div className="inline-flex w-full items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 text-sm font-medium text-white/70 md:w-auto md:shrink-0">
        <button
          type="button"
          onClick={() => onModeChange("single")}
          className={`inline-flex flex-1 items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition md:flex-none ${
            mode === "single"
              ? "border border-primary/30 bg-primary/20 text-white shadow-sm"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          }`}
        >
          Per Bulan
        </button>
        <button
          type="button"
          onClick={() => onModeChange("range")}
          className={`inline-flex flex-1 items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition md:flex-none ${
            mode === "range"
              ? "border border-primary/30 bg-primary/20 text-white shadow-sm"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          }`}
        >
          Rentang Bulan
        </button>
      </div>
      <div className="flex w-full flex-col gap-3 md:w-[360px]">
        {mode === "single" ? (
          <MonthPicker
            label="Bulan"
            value={singleMonth}
            onChange={onSingleMonthChange}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <MonthPicker
              label="Mulai"
              value={rangeStart}
              onChange={onRangeStartChange}
            />
            <MonthPicker
              label="Sampai"
              value={rangeEnd}
              onChange={onRangeEndChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
