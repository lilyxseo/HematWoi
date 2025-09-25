import { RefreshCcw } from "lucide-react";
import clsx from "clsx";
import {
  DateRangeValue,
  ensureRangeOrder,
  formatRangeLabel,
  getThisMonthRange,
  getThisWeekRange,
  getTodayRange,
  toDateInputValue,
} from "../../lib/date-range";
import { useMemo } from "react";

export type PeriodPreset = "today" | "week" | "month" | "custom";

interface PeriodPickerProps {
  value: DateRangeValue;
  preset: PeriodPreset;
  onChange: (value: DateRangeValue) => void;
  onPresetChange: (preset: PeriodPreset) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const presets: { label: string; value: PeriodPreset }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "Custom", value: "custom" },
];

const inputClassName =
  "h-11 rounded-2xl border border-border/60 bg-white/70 px-4 text-sm font-medium shadow-sm ring-offset-background transition focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-zinc-900/70";

const buttonClassName =
  "flex-1 select-none rounded-2xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

const segmentedWrapperClassName =
  "flex w-full flex-wrap gap-2 rounded-2xl border border-border/60 bg-white/70 p-1 shadow-sm backdrop-blur dark:bg-zinc-900/70";

const getPresetRange = (preset: PeriodPreset): DateRangeValue => {
  switch (preset) {
    case "today":
      return getTodayRange();
    case "week":
      return getThisWeekRange();
    case "month":
      return getThisMonthRange();
    default:
      return getThisMonthRange();
  }
};

const RefreshButton = ({ onClick, loading }: { onClick?: () => void; loading?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/60 bg-white/80 px-4 text-sm font-semibold text-muted-foreground shadow-sm transition hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900/70"
  >
    <RefreshCcw className={clsx("h-4 w-4", loading && "animate-spin")} />
    Segarkan
  </button>
);

const CustomInputs = ({
  value,
  onChange,
  disabled,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  disabled?: boolean;
}) => {
  const startValue = value.start;
  const endValue = value.end;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Dari
        <input
          type="date"
          value={startValue}
          onChange={(event) => {
            if (!event.target.value) return;
            const next = ensureRangeOrder({
              start: event.target.value,
              end: endValue,
            });
            onChange(next);
          }}
          disabled={disabled}
          className={inputClassName}
          max={endValue}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Sampai
        <input
          type="date"
          value={endValue}
          onChange={(event) => {
            if (!event.target.value) return;
            const next = ensureRangeOrder({
              start: startValue,
              end: event.target.value,
            });
            onChange(next);
          }}
          disabled={disabled}
          className={inputClassName}
          min={startValue}
          max={toDateInputValue(new Date())}
        />
      </label>
    </div>
  );
};

const PeriodBadge = ({ value }: { value: DateRangeValue }) => {
  const label = useMemo(() => formatRangeLabel(value), [value]);
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-white/70 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm dark:bg-zinc-900/70">
      {label}
    </span>
  );
};

const PeriodPicker = ({
  value,
  preset,
  onChange,
  onPresetChange,
  onRefresh,
  loading,
}: PeriodPickerProps) => {
  const presetRangeLabel = useMemo(() => formatRangeLabel(value), [value]);

  return (
    <section className="space-y-3">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Periode transaksi
          </h2>
          <p className="text-sm text-muted-foreground">{presetRangeLabel}</p>
        </div>
        <RefreshButton onClick={onRefresh} loading={loading} />
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className={segmentedWrapperClassName}>
          {presets.map((item) => {
            const isActive = preset === item.value;
            const rangePreview =
              item.value !== "custom" ? formatRangeLabel(getPresetRange(item.value)) : undefined;
            return (
              <button
                key={item.value}
                type="button"
                className={clsx(
                  buttonClassName,
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                )}
                onClick={() => {
                  onPresetChange(item.value);
                  if (item.value !== "custom") {
                    onChange(getPresetRange(item.value));
                  }
                }}
                disabled={loading}
                title={rangePreview}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {preset === "custom" ? (
          <CustomInputs value={value} onChange={onChange} disabled={loading} />
        ) : (
          <PeriodBadge value={value} />
        )}
      </div>
    </section>
  );
};

export default PeriodPicker;

