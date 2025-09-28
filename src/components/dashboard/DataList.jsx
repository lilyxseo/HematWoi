import clsx from "clsx";
import { TrendingUp } from "lucide-react";
import Card, { CardHeader } from "../Card";

function EmptyListState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-sm text-muted/90">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-brand">
        <TrendingUp className="h-5 w-5" />
      </div>
      <p className="font-medium text-text/80 dark:text-slate-100/80">{message}</p>
    </div>
  );
}

export default function DataList({
  title,
  subtext,
  actions,
  columns = [],
  rows = [],
  rowKey = (row) => row.id,
  onRowClick,
  emptyMessage = "Belum ada data bulan ini.",
  className = "",
  maxHeight = 320,
  summary = [],
}) {
  const hasData = rows?.length > 0;
  const hasSummary = summary?.length > 0;

  return (
    <Card className={clsx("flex min-h-[360px] flex-col", className)}>
      <CardHeader title={title} subtext={subtext} actions={actions} />
      {hasSummary ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border/40 bg-surface-alt/40 p-4 shadow-inner backdrop-blur-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted/70">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold text-text dark:text-slate-100">
                {item.value}
              </p>
              {item.hint ? (
                <p className="mt-2 text-xs text-muted/70">{item.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className={clsx("flex-1", hasSummary ? "mt-5" : "mt-4")}> 
        {hasData ? (
          <div
            className="max-h-[320px] overflow-y-auto pr-1"
            style={{ maxHeight }}
          >
            <table className="min-w-full table-fixed text-sm">
              <thead className="text-left text-muted/80">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={clsx(
                        "px-3 py-2 font-medium",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center"
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.slice(0, 8).map((row, index) => (
                  <tr
                    key={rowKey(row, index)}
                    className={clsx(
                      "group cursor-pointer transition-colors hover:bg-white/5",
                      !onRowClick && "cursor-default"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={clsx(
                          "px-3 py-3 text-sm",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          typeof col.className === "function"
                            ? col.className(row)
                            : col.className
                        )}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyListState message={emptyMessage} />
        )}
      </div>
    </Card>
  );
}
