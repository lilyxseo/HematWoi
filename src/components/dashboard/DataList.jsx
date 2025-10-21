import clsx from "clsx";
import {
  IconTrendingUp as TrendingUp
} from '@tabler/icons-react';
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
}) {
  const hasData = rows?.length > 0;

  return (
    <Card className={clsx("flex min-h-[360px] flex-col", className)}>
      <CardHeader title={title} subtext={subtext} actions={actions} />
      <div className="mt-4 flex-1">
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
