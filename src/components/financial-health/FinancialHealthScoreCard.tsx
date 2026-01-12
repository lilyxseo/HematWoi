import clsx from "clsx";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

type ScoreComparison = {
  direction: "up" | "down" | "flat";
  value: number;
  label: string;
};

type MiniKpi = {
  label: string;
  value: string;
};

type NextAction = {
  label: string;
  href: string;
};

type FinancialHealthScoreCardProps = {
  score: number;
  label: string;
  subtitle: string;
  comparison?: ScoreComparison | null;
  kpis: MiniKpi[];
  nextActions: NextAction[];
  isEmpty: boolean;
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max);

function getScoreTone(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-lime-500";
  if (score >= 40) return "text-amber-500";
  return "text-rose-500";
}

export default function FinancialHealthScoreCard({
  score,
  label,
  subtitle,
  comparison,
  kpis,
  nextActions,
  isEmpty,
}: FinancialHealthScoreCardProps) {
  const safeScore = clamp(score);
  const radius = 58;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (safeScore / 100) * circumference;
  const toneClass = getScoreTone(safeScore);

  if (isEmpty) {
    return (
      <div className="rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-text">Financial Health Score</h2>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-5 rounded-2xl border border-dashed border-border-subtle bg-surface-2/60 p-5 text-center">
          <p className="text-sm font-semibold text-text">Belum ada transaksi</p>
          <p className="mt-1 text-sm text-muted">
            Tambahkan transaksi agar skor finansial dapat dihitung.
          </p>
          <a
            href="/transaction/add"
            className="mt-4 inline-flex items-center justify-center rounded-full border border-primary/30 bg-primary/20 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/25"
          >
            Tambah Transaksi
          </a>
        </div>
      </div>
    );
  }

  const TrendIcon =
    comparison?.direction === "up"
      ? TrendingUp
      : comparison?.direction === "down"
        ? TrendingDown
        : Minus;

  const trendText =
    comparison && Number.isFinite(comparison.value)
      ? `${comparison.value > 0 ? "+" : ""}${comparison.value.toFixed(1)}%`
      : "";

  return (
    <div className="rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-6">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <svg height={radius * 2} width={radius * 2}>
              <circle
                stroke="hsl(var(--color-border))"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke="currentColor"
                fill="transparent"
                strokeWidth={stroke}
                strokeLinecap="round"
                className={toneClass}
                strokeDasharray={`${circumference} ${circumference}`}
                style={{ strokeDashoffset }}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-4xl font-bold text-text">{safeScore}</div>
              <div className="text-xs text-muted">/ 100</div>
            </div>
          </div>
          <div className="max-w-sm">
            <h2 className="text-lg font-semibold text-text">Financial Health Score</h2>
            <p className="text-sm text-muted">{subtitle}</p>
            <p className="mt-2 text-sm text-muted">Kondisi</p>
            <p className="text-2xl font-semibold text-text">{label}</p>
            <p className="mt-2 text-sm text-muted">
              {safeScore >= 80 &&
                "Pertahankan kebiasaan finansialmu. Kamu sudah di jalur yang tepat."}
              {safeScore >= 60 && safeScore < 80 &&
                "Kondisi keuangan cukup stabil, tetap jaga disiplin pengeluaran."}
              {safeScore >= 40 && safeScore < 60 &&
                "Mulai cek pos pengeluaran utama agar cashflow tetap aman."}
              {safeScore < 40 &&
                "Perlu segera perbaiki cashflow dan kendalikan cicilan."}
            </p>
          </div>
        </div>
        {comparison ? (
          <div
            className={clsx(
              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold",
              comparison.direction === "up" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
              comparison.direction === "down" &&
                "border-rose-500/30 bg-rose-500/10 text-rose-400",
              comparison.direction === "flat" &&
                "border-border bg-surface-2 text-muted"
            )}
          >
            <TrendIcon className="h-4 w-4" />
            <span>
              {comparison.label}: {trendText}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-border-subtle bg-surface-2/60 px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase text-muted/70">{kpi.label}</p>
            <p className="mt-1 text-sm font-semibold text-text">{kpi.value}</p>
          </div>
        ))}
      </div>

      {nextActions.length ? (
        <div className="mt-6 rounded-2xl border border-border-subtle bg-surface-2/50 p-4">
          <p className="text-sm font-semibold text-text">What to do next</p>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {nextActions.slice(0, 2).map((action) => (
              <li key={action.label}>
                <a
                  href={action.href}
                  className="font-semibold text-primary hover:underline"
                >
                  {action.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
