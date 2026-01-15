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
  const TrendIcon =
    comparison?.direction === "up"
      ? TrendingUp
      : comparison?.direction === "down"
        ? TrendingDown
        : Minus;
  const scoreDescription =
    safeScore >= 90
      ? "Keuanganmu berada di kondisi yang sangat baik. Pertahankan kebiasaan ini agar tetap stabil."
      : safeScore >= 75
        ? "Kondisi keuanganmu cukup stabil, masih ada beberapa area kecil yang bisa ditingkatkan."
        : safeScore >= 60
          ? "Keuanganmu berjalan cukup baik, namun ada beberapa hal yang perlu diperhatikan."
          : safeScore >= 40
            ? "Ada kebiasaan finansial yang perlu diperbaiki agar kondisi keuangan tetap aman."
            : "Kondisi keuanganmu berisiko. Fokuskan perhatian pada arus kas dan pengeluaran.";

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Financial Health</h2>
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
            <span className="flex h-4 w-4 items-center justify-center">
              <TrendIcon className="h-4 w-4" />
            </span>
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
            {scoreDescription}
          </p>
        </div>
      </div>
    </div>
  );
}
