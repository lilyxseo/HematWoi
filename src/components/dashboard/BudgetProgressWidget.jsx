import { useMemo } from "react";
import clsx from "clsx";
import { ArrowUpRight, AlertTriangle, PiggyBank } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../Card";
import { formatBudgetAmount } from "../../lib/api-budgets";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPercent(value) {
  const numeric = toNumber(value);
  if (numeric <= 0) return 0;
  if (numeric <= 1) return numeric * 100;
  return numeric;
}

function normalizeStatusRow(row) {
  if (!row) return null;
  const category = row.category || row.category_name || row.name || row.label;
  if (!category) return null;
  const planned = toNumber(row.planned ?? row.amount_planned);
  const actual = Math.abs(toNumber(row.actual ?? row.spent ?? row.current_spent));
  const percent = toPercent(row.pct ?? row.percentage ?? row.ratio ?? row.utilization);
  if (percent <= 0 && actual <= 0) return null;
  const remaining = planned - actual;
  return {
    id: `${category}-${percent.toFixed(2)}`,
    category,
    planned,
    actual,
    remaining,
    percent,
  };
}

function pickTopBudgets(rows) {
  const normalized = rows
    .map(normalizeStatusRow)
    .filter(Boolean);

  if (!normalized.length) return [];

  const scored = normalized.map((item) => ({
    ...item,
    score: Math.abs(100 - item.percent),
  }));

  scored.sort((a, b) => {
    if (a.score === b.score) {
      return b.percent - a.percent;
    }
    return a.score - b.score;
  });

  return scored.slice(0, 3);
}

export default function BudgetProgressWidget({ status = [] }) {
  const topBudgets = useMemo(() => pickTopBudgets(status), [status]);
  const hasBudgets = topBudgets.length > 0;

  return (
    <Card className="bg-gradient-to-br from-white/90 via-white/60 to-white/40 p-6 shadow-lg ring-1 ring-border-subtle/60 dark:from-zinc-900/70 dark:via-zinc-900/50 dark:to-zinc-900/40">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-left">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <PiggyBank className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600/80 dark:text-amber-300/90">
              Budget Insight
            </p>
            <h2 className="text-xl font-semibold text-text sm:text-2xl">
              Hampir Mencapai Batas
            </h2>
            <p className="text-sm text-muted">
              Pantau kategori anggaran yang mendekati 100% penggunaan.
            </p>
          </div>
        </div>
        <Link
          to="/budgets"
          className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-600 transition hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-300"
        >
          Info lengkap
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-6 space-y-4">
        {hasBudgets ? (
          topBudgets.map((item, index) => {
            const percentLabel = `${Math.round(item.percent)}%`;
            const isOver = item.percent >= 100;
            const barWidth = Math.min(item.percent, 130);
            return (
              <article
                key={item.id || item.category || index}
                className="group rounded-2xl border border-border-subtle/70 bg-surface-alt/70 p-4 shadow-sm transition hover:border-amber-500/40 hover:bg-surface-alt/90 dark:border-white/10"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">#{index + 1}</p>
                    <p className="mt-1 text-base font-semibold text-text sm:text-lg">
                      {item.category}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold",
                      isOver
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {percentLabel}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-border-subtle/60">
                  <div
                    className={clsx(
                      "h-2 rounded-full transition-all",
                      isOver ? "bg-rose-500" : "bg-amber-500"
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>
                    <dt className="font-medium text-text">Rencana</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text">
                      {formatBudgetAmount(item.planned)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-text">Realisasi</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text">
                      {formatBudgetAmount(item.actual)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-text">Sisa</dt>
                    <dd
                      className={clsx(
                        "mt-0.5 text-sm font-semibold",
                        item.remaining < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-text"
                      )}
                    >
                      {formatBudgetAmount(item.remaining)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-text">Progress</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-text">
                      {percentLabel}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border-subtle bg-surface-alt/60 p-6 text-left">
            <p className="text-sm text-muted-foreground">
              Data anggaran belum tersedia atau belum mendekati batas. Mulai kelola anggaranmu untuk melihat insight di sini.
            </p>
            <Link
              to="/budgets"
              className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600 transition hover:text-amber-500 dark:text-amber-300"
            >
              Buat atau kelola budget
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
