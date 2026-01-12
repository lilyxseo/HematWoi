import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const MONTH_LABEL =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      })
    : null;

function parseMonth(value: string) {
  const [year, month] = value.split("-").map((entry) => Number.parseInt(entry, 10));
  if (!year || !month) return null;
  return { year, month };
}

function toValue(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatLabel(value: string) {
  const parsed = parseMonth(value);
  if (!parsed) return "Pilih bulan";
  const date = new Date(parsed.year, parsed.month - 1, 1);
  return MONTH_LABEL ? MONTH_LABEL.format(date) : value;
}

export default function MonthPicker({ value, onChange, label }: MonthPickerProps) {
  const parsed = parseMonth(value) ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(parsed.year);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setYear(parsed.year);
  }, [parsed.year]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const labelText = useMemo(() => formatLabel(value), [value]);

  return (
    <div ref={wrapperRef} className="relative flex w-full flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-text shadow-sm transition hover:bg-white/7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{labelText}</span>
        <Calendar className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-xl"
        >
          <div className="flex items-center justify-between text-sm text-text">
            <button
              type="button"
              onClick={() => setYear((prev) => prev - 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Tahun sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{year}</span>
            <button
              type="button"
              onClick={() => setYear((prev) => prev + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Tahun berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {MONTHS.map((monthLabel, index) => {
              const monthValue = index + 1;
              const selected = parsed.year === year && parsed.month === monthValue;
              return (
                <button
                  key={monthLabel}
                  type="button"
                  onClick={() => {
                    onChange(toValue(year, monthValue));
                    setOpen(false);
                  }}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    selected
                      ? "border-primary/30 bg-primary/20 text-text shadow"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {monthLabel}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                onChange(toValue(now.getFullYear(), now.getMonth() + 1));
                setOpen(false);
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10"
            >
              Bulan ini
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                onChange(toValue(last.getFullYear(), last.getMonth() + 1));
                setOpen(false);
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10"
            >
              Bulan lalu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
