import MonthPicker from "./MonthPicker";

type PeriodToolbarProps = {
  mode: "single" | "range";
  onModeChange: (mode: "single" | "range") => void;
  singleMonth: string;
  rangeStart: string;
  rangeEnd: string;
  onSingleMonthChange: (value: string) => void;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onReset?: () => void;
  statusBadge?: string | null;
};

export default function PeriodToolbar({
  mode,
  onModeChange,
  singleMonth,
  rangeStart,
  rangeEnd,
  onSingleMonthChange,
  onRangeStartChange,
  onRangeEndChange,
  onReset,
  statusBadge,
}: PeriodToolbarProps) {
  return (
    <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
      {statusBadge ? (
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
          {statusBadge}
        </span>
      ) : null}
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 text-sm font-medium text-white/80">
        <button
          type="button"
          onClick={() => onModeChange("single")}
          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
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
          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "range"
              ? "border border-primary/30 bg-primary/20 text-white shadow-sm"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          }`}
        >
          Rentang Bulan
        </button>
      </div>
      {mode === "single" ? (
        <div className="min-w-[220px]">
          <MonthPicker
            label="Bulan"
            value={singleMonth}
            onChange={onSingleMonthChange}
          />
        </div>
      ) : (
        <div className="grid min-w-[220px] gap-3 md:grid-cols-2">
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
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="h-10 rounded-full border border-white/10 px-3 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}
