import { useMemo, useState } from "react";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Segmented from "./ui/Segmented";
import Card, { CardBody, CardHeader } from "./Card";
import { formatCurrency } from "../lib/format";

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return dateTimeFormatter.format(new Date(value));
  } catch {
    return value;
  }
}

export default function RecentTransactions({ txs = [] }) {
  const [period, setPeriod] = useState("week");

  const filtered = useMemo(() => {
    const now = new Date();
    return (txs ?? [])
      .filter((t) => {
        const date = new Date(t?.date);
        if (Number.isNaN(date.getTime())) return false;
        const diffInDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
        if (period === "day") return diffInDays < 1;
        if (period === "week") return diffInDays < 7;
        return diffInDays < 30;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
  }, [txs, period]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, item) => {
          const amount = Math.abs(Number(item?.amount ?? 0));
          if (item?.type === "income") {
            acc.income += amount;
          } else {
            acc.expense += amount;
          }
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [filtered]
  );

  const net = totals.income - totals.expense;

  const periodLabel =
    period === "day" ? "24 jam" : period === "week" ? "7 hari" : "30 hari";

  return (
    <Card className="flex min-h-[360px] flex-col">
      <CardHeader
        title="Transaksi Terbaru"
        subtext={`Ringkasan transaksi ${periodLabel} terakhir`}
        actions={
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { label: "Hari", value: "day" },
              { label: "Minggu", value: "week" },
              { label: "Bulan", value: "month" },
            ]}
          />
        }
      />

      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="grid gap-3 rounded-2xl border border-border-subtle/70 bg-surface-alt/60 p-4 text-sm font-medium text-text sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Pemasukan
            </span>
            <span className="text-success">+{formatCurrency(totals.income)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Pengeluaran
            </span>
            <span className="text-danger">-{formatCurrency(totals.expense)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Net
            </span>
            <span className={net >= 0 ? "text-success" : "text-danger"}>
              {net >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(net))}
            </span>
          </div>
        </div>

        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border-subtle/70 bg-surface-alt/60 px-4 py-10 text-center text-sm text-muted">
              <ArrowUpRight className="mb-3 h-5 w-5 text-muted" />
              Belum ada transaksi pada periode ini.
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((item) => {
                const amount = Math.abs(Number(item?.amount ?? 0));
                const isIncome = item?.type === "income";
                const Icon = isIncome ? ArrowDownRight : ArrowUpRight;

                return (
                  <li
                    key={item?.id ?? `${item?.note}-${item?.date}-${item?.amount}`}
                    className="group flex items-center gap-4 rounded-2xl border border-border-subtle/60 bg-surface-alt/40 p-3 transition hover:border-border-subtle hover:bg-surface-alt"
                  >
                    <span
                      className={clsx(
                        "flex h-10 w-10 flex-none items-center justify-center rounded-2xl",
                        isIncome
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text">
                        {item?.note || item?.category || "Tanpa catatan"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
                        <span className="truncate font-medium text-muted">
                          {item?.category || "Lainnya"}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-border-subtle" aria-hidden="true" />
                        <span>{formatDateTime(item?.date)}</span>
                      </div>
                    </div>

                    <div
                      className={clsx(
                        "text-right text-sm font-semibold",
                        isIncome ? "text-success" : "text-danger"
                      )}
                    >
                      {isIncome ? "+" : "-"}
                      {formatCurrency(amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
