import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import Card, { CardBody, CardHeader } from "../Card";
import { formatCurrency } from "../../lib/format";

function normalizeBudgetRow(row, index) {
  if (!row) return null;

  const plannedRaw =
    typeof row.planned === "number"
      ? row.planned
      : typeof row.amount_planned === "number"
        ? row.amount_planned
        : Number.parseFloat(row.planned ?? row.amount_planned ?? "0");
  const actualRaw =
    typeof row.actual === "number"
      ? row.actual
      : typeof row.spent === "number"
        ? row.spent
        : Number.parseFloat(row.actual ?? row.spent ?? "0");
  let pctRaw =
    typeof row.pct === "number"
      ? row.pct
      : Number.parseFloat(row.pct ?? "0");

  const planned = Number.isFinite(plannedRaw) ? Math.max(plannedRaw, 0) : 0;
  const actual = Number.isFinite(actualRaw) ? Math.max(actualRaw, 0) : 0;
  if (!planned) return null;

  if (Number.isFinite(pctRaw) && pctRaw > 0) {
    pctRaw = pctRaw <= 1 ? pctRaw * 100 : pctRaw;
  } else {
    pctRaw = planned > 0 ? (actual / planned) * 100 : 0;
  }

  const pct = Number.isFinite(pctRaw) ? pctRaw : 0;

  const category =
    typeof row.category === "string" && row.category.trim()
      ? row.category.trim()
      : typeof row.category_name === "string" && row.category_name.trim()
        ? row.category_name.trim()
        : `Kategori ${index + 1}`;

  return {
    id: `${category}-${index}`,
    category,
    planned,
    actual,
    pct,
  };
}

function describeStatus(pct) {
  if (pct >= 110) {
    return {
      label: "Lewat batas",
      badge: "bg-danger/10 text-danger",
    };
  }
  if (pct >= 95) {
    return {
      label: "Hampir habis",
      badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  return {
    label: "Perlu perhatian",
    badge: "bg-primary/10 text-primary",
  };
}

export default function BudgetNearLimitWidget({ data = [] }) {
  const budgets = useMemo(() => {
    const normalized = (Array.isArray(data) ? data : [])
      .map((row, index) => normalizeBudgetRow(row, index))
      .filter(Boolean);

    if (!normalized.length) return [];

    const prioritized = normalized
      .map((item) => ({
        ...item,
        pct: Math.max(0, item.pct),
        distance: Math.abs(100 - item.pct),
      }))
      .filter((item) => item.pct >= 60)
      .sort((a, b) => {
        if (a.distance === b.distance) {
          return b.pct - a.pct;
        }
        return a.distance - b.distance;
      });

    if (prioritized.length >= 3) {
      return prioritized.slice(0, 3);
    }

    const fallback = normalized
      .map((item) => ({
        ...item,
        pct: Math.max(0, item.pct),
        distance: Math.abs(100 - item.pct),
      }))
      .sort((a, b) => {
        if (a.distance === b.distance) {
          return b.pct - a.pct;
        }
        return a.distance - b.distance;
      });

    return fallback.slice(0, 3);
  }, [data]);

  return (
    <Card>
      <CardHeader
        title="Budget Hampir Habis"
        subtext="Pantau anggaran yang mendekati 100% sebelum terlambat"
        actions={
          <Link
            to="/budgets"
            className="btn btn-secondary btn-sm"
          >
            Lihat semua
          </Link>
        }
      />
      <CardBody className="space-y-4">
        {budgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-subtle bg-surface-alt/60 p-6 text-center text-sm text-muted">
            <AlertTriangle className="h-5 w-5 text-muted" aria-hidden="true" />
            <p>Belum ada anggaran yang mendekati batas bulan ini.</p>
          </div>
        ) : (
          budgets.map((budget) => {
            const usage = Math.min(100, Math.round(budget.pct * 10) / 10);
            const over = budget.pct - 100;
            const remaining = budget.planned - budget.actual;
            const status = describeStatus(budget.pct);
            return (
              <article
                key={budget.id}
                className="rounded-2xl border border-border-subtle bg-surface-alt/50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted">Kategori</p>
                    <h3 className="text-base font-semibold text-text sm:text-lg">
                      {budget.category}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>
                    {status.label}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="font-semibold text-text">
                    {Math.round(budget.pct)}%
                  </span>
                  <span>terpakai</span>
                  <span className="hidden sm:inline">•</span>
                  <span>
                    {formatCurrency(budget.actual, "IDR")} / {formatCurrency(budget.planned, "IDR")}
                  </span>
                  {remaining < 0 ? (
                    <span className="hidden sm:inline text-danger">
                      • Lebih {formatCurrency(Math.abs(remaining), "IDR")}
                    </span>
                  ) : (
                    <span className="hidden sm:inline">
                      • Sisa {formatCurrency(Math.max(remaining, 0), "IDR")}
                    </span>
                  )}
                </div>
                <div className="mt-4 h-2 rounded-full bg-border-subtle">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500"
                    style={{ width: `${usage}%` }}
                    aria-hidden="true"
                  />
                </div>
                {over > 0 && (
                  <p className="mt-2 text-xs font-medium text-danger">
                    Anggaran sudah terlewati {Math.round(over)}%.
                  </p>
                )}
              </article>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
