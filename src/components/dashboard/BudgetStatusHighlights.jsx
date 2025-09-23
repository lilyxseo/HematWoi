import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import Card, { CardBody, CardHeader } from "../Card";
import { supabase } from "../../lib/supabase";

const percentFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value);
  return percentFormatter.format(rounded);
}

function sanitizeRow(row) {
  const pct = Number(row?.pct ?? 0);
  return {
    category: row?.category_name || row?.category || "Tanpa kategori",
    pct: Number.isFinite(pct) ? pct : 0,
  };
}

const NEAR_STYLE = "border-warning/40 bg-warning/10 text-warning";
const OVER_STYLE = "border-danger/40 bg-danger/10 text-danger";

function BudgetStatusGroup({
  title,
  description,
  items,
  tone,
  emptyMessage,
}) {
  return (
    <div className="flex-1 space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {title}
        </p>
        {description ? (
          <p className="text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={`${item.category}-${item.pct}`}
              className={`inline-flex max-w-full items-center gap-2 truncate rounded-full border px-3 py-1 text-xs font-semibold tabular-nums ${tone}`}
            >
              <span className="max-w-[9rem] truncate text-left">
                {item.category}
              </span>
              <span>{formatPercent(item.pct)}%</span>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">{emptyMessage}</p>
      )}
    </div>
  );
}

export default function BudgetStatusHighlights({ userId, online }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState([]);

  useEffect(() => {
    let cancelled = false;

    if (!online || !userId) {
      setRecords([]);
      setLoading(false);
      setError("");
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError("");

    (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("v_budget_status_month")
          .select("category_name, amount_planned, actual, pct")
          .order("pct", { ascending: false })
          .limit(5);
        if (queryError) throw queryError;
        if (cancelled) return;
        const sanitized = (data ?? [])
          .map(sanitizeRow)
          .filter((row) => row.pct >= 80);
        setRecords(sanitized);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Gagal memuat data");
        setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [online, userId]);

  const { nearBudget, overBudget } = useMemo(() => {
    const near = records.filter((row) => row.pct >= 80 && row.pct < 100);
    const over = records.filter((row) => row.pct >= 100);
    return { nearBudget: near, overBudget: over };
  }, [records]);

  return (
    <Card>
      <CardHeader
        title="Status Budget"
        subtext="Pantau kategori yang mendekati atau melampaui batas bulan ini"
        actions={
          <Link
            to="/budgets"
            className="inline-flex items-center gap-2 text-xs font-semibold text-brand hover:text-brand-hover"
          >
            Kelola Budget
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />
      <CardBody className="space-y-4">
        {loading ? (
          <div className="flex flex-col gap-4 md:flex-row">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="flex-1 space-y-3">
                <div className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-border/60" />
                  <div className="h-3 w-32 animate-pulse rounded-full bg-border/40" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 3 }).map((__, chipIndex) => (
                    <div
                      key={`skeleton-chip-${index}-${chipIndex}`}
                      className="h-7 w-28 animate-pulse rounded-full bg-border/40"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-danger">Gagal memuat status budget: {error}</p>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row">
            <BudgetStatusGroup
              title="Hampir mencapai budget"
              description="80% - 99% dari rencana"
              items={nearBudget}
              tone={NEAR_STYLE}
              emptyMessage="Belum ada kategori yang mendekati batas."
            />
            <BudgetStatusGroup
              title="Melebihi budget"
              description={"≥ 100% dari rencana"}
              items={overBudget}
              tone={OVER_STYLE}
              emptyMessage="Belum ada kategori yang melampaui budget."
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
