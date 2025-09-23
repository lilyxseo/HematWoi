import type { Insight } from "../hooks/useInsights";

const CURRENCY = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const DATE_LABEL = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
});

const severityStyles: Record<Insight["severity"], string> = {
  high:
    "border border-rose-300 bg-rose-50 text-rose-950 shadow-sm dark:border-rose-500/70 dark:bg-rose-950/50 dark:text-rose-100",
  med:
    "border border-amber-300 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-500/70 dark:bg-amber-950/50 dark:text-amber-100",
  low:
    "border border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm dark:border-emerald-500/70 dark:bg-emerald-950/40 dark:text-emerald-50",
};

function toCurrency(value: unknown): string {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  return CURRENCY.format(Number.isFinite(num) ? num : 0);
}

function formatDate(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return DATE_LABEL.format(date);
}

function buildDetail(insight: Insight): string | null {
  const { type, meta } = insight;
  if (!meta) return null;
  if (type === "budget" && meta.projected != null && meta.planned != null) {
    return `Perkiraan: ${toCurrency(meta.projected)} • Budget: ${toCurrency(meta.planned)}`;
  }
  if (type === "good" && meta.todaySpend != null && meta.average14 != null) {
    return `Hari ini ${toCurrency(meta.todaySpend)} vs rata-rata 14 hari ${toCurrency(meta.average14)}`;
  }
  if (type === "subs" && meta.amount != null) {
    const due = formatDate(meta.dueDate);
    return due ? `Jatuh tempo ${due} • Tagihan ${toCurrency(meta.amount)}` : `Tagihan ${toCurrency(meta.amount)}`;
  }
  if (type === "goal" && typeof meta.milestone === "string") {
    return `Progress ${meta.milestone}`;
  }
  if (type === "trend" && meta.currentCount != null && meta.previousCount != null) {
    return `Transaksi ${meta.currentCount}x vs minggu lalu ${meta.previousCount}x`;
  }
  if (type === "trend" && meta.category && meta.amount != null) {
    return `Total ${toCurrency(meta.amount)}`;
  }
  if (type === "warn" && meta.net != null) {
    return `Defisit ${toCurrency(Math.abs(Number(meta.net)))} bulan ini`;
  }
  return null;
}

interface InsightCardProps {
  insight: Insight;
}

export default function InsightCard({ insight }: InsightCardProps) {
  const detail = buildDetail(insight);
  const severityClass = severityStyles[insight.severity] ?? severityStyles.low;

  return (
    <article
      className={`flex h-full flex-col justify-between rounded-xl p-4 transition-shadow duration-200 ${severityClass}`}
    >
      <p className="text-sm font-semibold leading-relaxed sm:text-base">{insight.message}</p>
      {detail && (
        <p className="mt-3 text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-200">
          {detail}
        </p>
      )}
    </article>
  );
}
