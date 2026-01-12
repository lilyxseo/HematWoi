import { Fragment, useEffect, useMemo, useState } from "react";
import { Popover, Transition } from "@headlessui/react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2024, index, 1);
  return new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);
});

function toMonthKey(year: number, monthIndex: number) {
  const month = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthKey(value: string) {
  if (!value) return null;
  const [year, month] = value.split("-").map((entry) => Number.parseInt(entry, 10));
  if (!year || !month) return null;
  return { year, monthIndex: month - 1 };
}

interface MonthPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function MonthPicker({
  label,
  value,
  onChange,
  className,
}: MonthPickerProps) {
  const today = useMemo(() => new Date(), []);
  const parsed = parseMonthKey(value);
  const [viewYear, setViewYear] = useState(
    parsed?.year ?? today.getFullYear()
  );

  useEffect(() => {
    if (parsed?.year) {
      setViewYear(parsed.year);
    }
  }, [parsed?.year]);

  const selectedKey = parsed ? toMonthKey(parsed.year, parsed.monthIndex) : "";
  const yearOptions = useMemo(() => {
    const start = today.getFullYear() - 5;
    const end = today.getFullYear() + 1;
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [today]);

  return (
    <Popover className={clsx("relative w-full", className)}>
      {({ close }) => (
        <>
          <Popover.Button className="flex w-full flex-col gap-1 text-left text-xs font-semibold uppercase text-muted/70">
            <span>{label}</span>
            <span className="relative inline-flex h-10 w-full min-w-[220px] items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-text shadow-sm transition hover:bg-white/10">
              <span>
                {selectedKey
                  ? new Intl.DateTimeFormat("id-ID", {
                      month: "long",
                      year: "numeric",
                    }).format(
                      new Date(parsed?.year ?? viewYear, parsed?.monthIndex ?? 0, 1)
                    )
                  : "Pilih bulan"}
              </span>
              <Calendar className="h-4 w-4 text-muted" />
            </span>
          </Popover.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <Popover.Panel className="absolute right-0 z-30 mt-2 w-[280px] rounded-2xl border border-white/10 bg-surface-1 p-4 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setViewYear((prev) => prev - 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted transition hover:text-text"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <select
                  value={viewYear}
                  onChange={(event) => setViewYear(Number(event.target.value))}
                  className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-sm font-semibold text-text"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setViewYear((prev) => prev + 1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted transition hover:text-text"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {MONTH_LABELS.map((label, index) => {
                  const key = toMonthKey(viewYear, index);
                  const isSelected = key === selectedKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onChange(key);
                        close();
                      }}
                      className={clsx(
                        "rounded-lg px-2 py-2 text-sm font-semibold transition",
                        isSelected
                          ? "border border-primary/30 bg-primary/20 text-text shadow-sm"
                          : "border border-transparent text-muted hover:border-white/10 hover:bg-white/5 hover:text-text"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    onChange(toMonthKey(now.getFullYear(), now.getMonth()));
                    close();
                  }}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-text transition hover:bg-white/10"
                >
                  Bulan ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    onChange(toMonthKey(previous.getFullYear(), previous.getMonth()));
                    close();
                  }}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-text transition hover:bg-white/10"
                >
                  Bulan lalu
                </button>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
