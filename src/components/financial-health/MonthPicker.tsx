import clsx from "clsx";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type MonthPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

const MONTH_FORMATTER =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", { month: "short" })
    : null;

function getMonthLabel(monthIndex: number) {
  const date = new Date(2024, monthIndex, 1);
  return MONTH_FORMATTER ? MONTH_FORMATTER.format(date) : `${monthIndex + 1}`;
}

function toMonthValue(year: number, month: number) {
  const safeMonth = String(month + 1).padStart(2, "0");
  return `${year}-${safeMonth}`;
}

function parseMonthValue(value: string) {
  const [year, month] = value.split("-").map((entry) => Number.parseInt(entry, 10));
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth = Number.isFinite(month) ? Math.max(1, Math.min(month, 12)) : 1;
  return { year: safeYear, month: safeMonth - 1 };
}

function buildYearOptions(selectedYear: number) {
  const start = selectedYear - 6;
  return Array.from({ length: 13 }, (_, index) => start + index);
}

export default function MonthPicker({ label, value, onChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const parsed = useMemo(() => parseMonthValue(value), [value]);
  const [viewYear, setViewYear] = useState(parsed.year);

  useEffect(() => {
    setViewYear(parsed.year);
  }, [parsed.year]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  const monthLabel = `${getMonthLabel(parsed.month)} ${parsed.year}`;
  const yearOptions = buildYearOptions(viewYear);

  return (
    <label className="flex w-full flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-white/60">
      <span>{label}</span>
      <div className="relative w-full">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-10 w-full min-w-[220px] items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/90 shadow-sm transition hover:bg-white/7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>{monthLabel}</span>
          <Calendar className="h-4 w-4 text-white/60" />
        </button>
        {open ? (
          <div
            ref={panelRef}
            role="dialog"
            className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-surface-1 p-3 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewYear((year) => year - 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Tahun sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={viewYear}
                onChange={(event) => setViewYear(Number(event.target.value))}
                className="h-9 w-full rounded-full border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Pilih tahun"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setViewYear((year) => year + 1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Tahun berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, index) => {
                const isSelected = parsed.year === viewYear && parsed.month === index;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      onChange(toMonthValue(viewYear, index));
                      setOpen(false);
                    }}
                    className={clsx(
                      "rounded-xl border px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      isSelected
                        ? "border-primary/30 bg-primary/20 text-white shadow-sm"
                        : "border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                    )}
                    aria-pressed={isSelected}
                  >
                    {getMonthLabel(index)}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  onChange(toMonthValue(today.getFullYear(), today.getMonth()));
                  setOpen(false);
                }}
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Bulan ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                  onChange(toMonthValue(previous.getFullYear(), previous.getMonth()));
                  setOpen(false);
                }}
                className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Bulan lalu
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}
