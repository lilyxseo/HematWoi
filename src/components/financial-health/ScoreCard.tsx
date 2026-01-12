import clsx from "clsx";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

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

interface ScoreCardProps {
  score: number;
  label: string;
  subtitle: string;
  comparison?: ScoreComparison | null;
}

export default function ScoreCard({
  score,
  label,
  subtitle,
  comparison,
}: ScoreCardProps) {
  const safeScore = clamp(score);
  const radius = 56;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (safeScore / 100) * circumference;
  const toneClass = getScoreTone(safeScore);

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">
            Financial Health Score
          </h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
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
            {comparison.direction === "up" ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : comparison.direction === "down" ? (
              <TrendingDown className="h-3.5 w-3.5" />
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
            <span>
              {comparison.label} · {comparison.value.toFixed(0)}%
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-6">
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
          <p className="text-sm text-muted">Kondisi</p>
          <p className="text-2xl font-semibold text-text">{label}</p>
          <p className="mt-2 max-w-xs text-sm text-muted">
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
    </div>
  );
}
