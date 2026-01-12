import { Link } from "react-router-dom";
import clsx from "clsx";

export type InsightSeverity = "high" | "medium" | "low";

export interface InsightItem {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  ctaLabel: string;
  ctaHref: string;
}

function getSeverityStyles(severity: InsightSeverity) {
  if (severity === "high") {
    return {
      wrapper: "border-rose-500/30 bg-rose-500/5",
      badge: "bg-rose-500/10 text-rose-600",
      icon: "text-rose-500",
      label: "High",
    };
  }
  if (severity === "medium") {
    return {
      wrapper: "border-amber-500/30 bg-amber-500/5",
      badge: "bg-amber-500/10 text-amber-600",
      icon: "text-amber-500",
      label: "Medium",
    };
  }
  return {
    wrapper: "border-emerald-500/30 bg-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-600",
    icon: "text-emerald-500",
    label: "Low",
  };
}

export default function InsightList({ insights }: { insights: InsightItem[] }) {
  if (!insights.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-1 p-6 text-center text-sm text-muted">
        Belum ada insight khusus. Pertahankan kebiasaan keuanganmu!
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((item) => {
        const styles = getSeverityStyles(item.severity);
        return (
          <div
            key={item.id}
            className={clsx(
              "flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              styles.wrapper
            )}
          >
            <div className="flex items-start gap-3">
              <span className={clsx("text-lg", styles.icon)}>●</span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-text">
                    {item.title}
                  </h4>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      styles.badge
                    )}
                  >
                    {styles.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {item.description}
                </p>
              </div>
            </div>
            <Link
              to={item.ctaHref}
              className="inline-flex items-center justify-center rounded-full border border-border bg-surface-2 px-4 py-2 text-xs font-semibold text-text transition hover:border-primary hover:text-primary"
            >
              {item.ctaLabel}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
