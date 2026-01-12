import clsx from "clsx";
import { Link } from "react-router-dom";
import { MoreHorizontal, TrendingDown, TrendingUp } from "lucide-react";

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max);

function getScoreTone(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-lime-500";
  if (score >= 40) return "text-amber-500";
  return "text-rose-500";
}

export type ScoreComparison = {
  direction: "up" | "down" | "flat";
  value: number;
  label: string;
};

type QuickMetric = {
  label: string;
  value: string;
};

type NextAction = {
  label: string;
  href: string;
};

interface FinancialHealthScoreCardProps {
  score: number;
  label: string;
  subtitle: string;
  comparison?: ScoreComparison | null;
  metrics: QuickMetric[];
  nextActions: NextAction[];
  isEmpty: boolean;
}

export default function FinancialHealthScoreCard({
  score,
  label,
  subtitle,
  comparison,
  metrics,
  nextActions,
  isEmpty,
}: FinancialHealthScoreCardProps) {
  const safeScore = clamp(score);
  const radius = 56;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (safeScore / 100) * circumference;
  const toneClass = getScoreTone(safeScore);

  const trendIcon =
    comparison?.direction === "up"
      ? TrendingUp
      : comparison?.direction === "down"
        ? TrendingDown
        : MoreHorizontal;
  const trendTone =
    comparison?.direction === "up"
      ? "text-emerald-500"
      : comparison?.direction === "down"
        ? "text-rose-500"
        : "text-muted";

  return (
    <div className="rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-sm">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-6">
          <div className="relative flex h-32 w-32 items-center justify-center">
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
              <div className="text-3xl font-bold text-text">
                {safeScore}
              </div>
              <div className="text-xs text-muted">/ 100</div>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text">
              Financial Health Score
            </h2>
            <p className="text-sm text-muted">{subtitle}</p>
            <p className="mt-3 text-sm text-muted">Kondisi</p>
            <p className="text-2xl font-semibold text-text">{label}</p>
            <p className="mt-2 max-w-md text-sm text-muted">
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
        <div className="flex flex-col gap-4 md:items-end">
          {comparison ? (
            <div
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                comparison.direction === "up" &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
                comparison.direction === "down" &&
                  "border-rose-500/30 bg-rose-500/10 text-rose-600",
                comparison.direction === "flat" &&
                  "border-border bg-surface-2 text-muted"
              )}
            >
              {(() => {
                const Icon = trendIcon;
                return <Icon className={clsx("h-4 w-4", trendTone)} />;
              })()}
              <span>
                {comparison.label}: {comparison.value.toFixed(1)}%
              </span>
            </div>
          ) : null}
          {isEmpty ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-2 p-4 text-sm text-muted">
              Belum ada transaksi untuk menghitung skor. Catat transaksi pertama
              untuk memulai.
              <Link
                to="/transaction/add"
                className="mt-3 inline-flex text-xs font-semibold text-primary"
              >
                Tambah transaksi
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-border-subtle bg-surface-2 p-4 text-sm text-muted">
              <p className="text-xs font-semibold uppercase text-muted">
                What to do next
              </p>
              <ul className="mt-2 space-y-2">
                {nextActions.map((action) => (
                  <li key={action.label}>
                    <Link
                      to={action.href}
                      className="text-sm font-semibold text-text hover:text-primary"
                    >
                      {action.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {!isEmpty && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-border-subtle bg-surface-2 p-3"
            >
              <p className="text-xs text-muted">{metric.label}</p>
              <p className="text-base font-semibold text-text">{metric.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
