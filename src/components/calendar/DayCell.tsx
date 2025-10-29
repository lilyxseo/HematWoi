import { memo, useMemo } from "react";
import clsx from "clsx";
import { formatCurrency } from "../../lib/format";
import type { DayAggregate } from "../../hooks/useMonthAggregates";

const DAY_LABEL =
  typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

const COMPACT =
  typeof Intl !== "undefined"
    ? new Intl.NumberFormat("id-ID", {
        notation: "compact",
        maximumFractionDigits: 1,
      })
    : null;

function formatCompactIDR(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }
  if (!COMPACT) {
    return formatCurrency(value, "IDR");
  }
  return `Rp ${COMPACT.format(value)}`;
}

function buildAriaLabel(
  date: Date,
  summary: DayAggregate | undefined,
  includeIncome: boolean,
): string {
  const dateLabel = DAY_LABEL ? DAY_LABEL.format(date) : date.toDateString();
  if (!summary) {
    return `${dateLabel}. Tidak ada transaksi.`;
  }
  const expenseLabel =
    summary.expenseTotal > 0
      ? `Total pengeluaran ${formatCurrency(summary.expenseTotal, "IDR")}`
      : "Tidak ada pengeluaran";
  const incomeLabel =
    includeIncome && summary.incomeTotal > 0
      ? `, pemasukan ${formatCurrency(summary.incomeTotal, "IDR")}`
      : "";
  const countLabel =
    summary.transactionCount > 0
      ? `, ${summary.transactionCount} transaksi`
      : ".";
  return `${dateLabel}. ${expenseLabel}${incomeLabel}${countLabel}`;
}

export interface DayCellProps {
  date: Date;
  dateKey: string;
  summary?: DayAggregate;
  isSelected: boolean;
  isToday: boolean;
  isOutside: boolean;
  includeIncome: boolean;
  onSelect: (date: Date) => void;
}

function DayCellComponent({
  date,
  dateKey,
  summary,
  isSelected,
  isToday,
  isOutside,
  includeIncome,
  onSelect,
}: DayCellProps) {
  const ariaLabel = useMemo(
    () => buildAriaLabel(date, summary, includeIncome),
    [date, summary, includeIncome],
  );

  const expenseDisplay = summary?.expenseTotal
    ? `-${formatCompactIDR(summary.expenseTotal)}`
    : "-";
  const incomeDisplay =
    includeIncome && summary?.incomeTotal
      ? `+${formatCompactIDR(summary.incomeTotal)}`
      : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={clsx(
        "relative flex h-full w-full flex-col rounded-xl border border-slate-900/60 p-2 text-left text-xs text-slate-200 transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        "hover:-translate-y-0.5 hover:shadow-lg",
        summary?.heatClass ?? "bg-slate-950/70",
        {
          "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-slate-950": isSelected,
          "border-slate-800": !isSelected,
          "shadow-[0_0_0_1px_rgba(244,114,182,0.25)]": isToday,
          "opacity-55": isOutside,
        },
      )}
      aria-pressed={isSelected}
      aria-label={ariaLabel}
      data-date={dateKey}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span
          className={clsx(
            "font-semibold",
            isToday ? "text-[var(--accent)]" : isOutside ? "text-slate-500" : "text-slate-300",
          )}
        >
          {date.getDate()}
        </span>
        {summary?.transactionCount ? (
          <span className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-slate-900/70 px-1 text-[10px] font-semibold text-slate-200">
            {summary.transactionCount}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-sm font-mono font-semibold text-rose-400">
        {expenseDisplay}
      </div>
      {incomeDisplay ? (
        <div className="mt-1 text-[11px] font-semibold text-emerald-400">
          {incomeDisplay}
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-slate-500">&nbsp;</div>
      )}
    </button>
  );
}

const DayCell = memo(DayCellComponent);

export default DayCell;
