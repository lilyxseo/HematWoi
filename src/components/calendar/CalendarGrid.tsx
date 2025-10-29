import { useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import DayCell from "./DayCell";
import type { DayAggregate } from "../../hooks/useMonthAggregates";

const WEEKDAY_LABELS = (() => {
  if (typeof Intl === "undefined") {
    return ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  }
  const base = new Date(2024, 0, 1); // Monday
  const labels: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(base.getTime());
    date.setDate(base.getDate() + i);
    labels.push(
      new Intl.DateTimeFormat("id-ID", { weekday: "short" })
        .format(date)
        .replace(".", "")
    );
  }
  return labels;
})();

const MONTH_LABEL =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" })
    : null;

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(base: Date, amount: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth() + amount, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildMonthCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: { date: Date; inCurrentMonth: boolean }[] = [];
  for (let index = 0; index < totalCells; index += 1) {
    const dayOffset = index - startOffset + 1;
    const cellDate = new Date(year, monthIndex, dayOffset);
    cellDate.setHours(0, 0, 0, 0);
    const inCurrentMonth =
      cellDate.getMonth() === monthIndex && cellDate.getFullYear() === year;
    cells.push({ date: cellDate, inCurrentMonth });
  }

  return cells;
}

export interface CalendarGridProps {
  monthDate: Date;
  selectedDate: Date | null;
  summaries: Record<string, DayAggregate>;
  includeIncome: boolean;
  loading: boolean;
  isFetching: boolean;
  onSelectDate: (date: Date) => void;
  onNavigateMonth: (nextMonth: Date) => void;
  onJumpToToday: () => void;
}

export default function CalendarGrid({
  monthDate,
  selectedDate,
  summaries,
  includeIncome,
  loading,
  isFetching,
  onSelectDate,
  onNavigateMonth,
  onJumpToToday,
}: CalendarGridProps) {
  const monthLabel = MONTH_LABEL ? MONTH_LABEL.format(monthDate) : monthDate.toDateString();
  const cells = useMemo(() => buildMonthCells(monthDate), [monthDate]);
  const todayKey = formatDateKey(new Date());
  const selectedKey = selectedDate ? formatDateKey(selectedDate) : null;
  const showSkeleton = loading && Object.keys(summaries).length === 0;

  return (
    <div className="rounded-3xl border border-slate-900/60 bg-slate-950/60 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold capitalize text-slate-50">
            {monthLabel}
          </h2>
          <p className="text-xs text-slate-400">Klik tanggal untuk melihat detail transaksi.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateMonth(addMonths(monthDate, -1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onJumpToToday}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <CalendarDays className="h-4 w-4" />
            Today
          </button>
          <button
            type="button"
            onClick={() => onNavigateMonth(addMonths(monthDate, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-200 transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2 md:gap-3">
        {showSkeleton
          ? Array.from({ length: cells.length }).map((_, index) => (
              <div
                key={`calendar-skel-${index}`}
                className="min-h-[108px] rounded-xl border border-slate-900/60 bg-slate-900/50"
              >
                <div className="h-full w-full animate-pulse rounded-xl bg-slate-800/40" />
              </div>
            ))
          : cells.map(({ date, inCurrentMonth }) => {
              const key = formatDateKey(date);
              const summary = summaries[key];
              return (
                <div key={key} className="min-h-[108px]">
                  <DayCell
                    date={date}
                    dateKey={key}
                    summary={summary}
                    isSelected={selectedKey === key}
                    isToday={todayKey === key}
                    isOutside={!inCurrentMonth}
                    includeIncome={includeIncome}
                    onSelect={onSelectDate}
                  />
                </div>
              );
            })}
      </div>
      {isFetching && !showSkeleton ? (
        <div className="mt-3 text-right text-[11px] font-medium text-slate-400">Memperbarui…</div>
      ) : null}
    </div>
  );
}
