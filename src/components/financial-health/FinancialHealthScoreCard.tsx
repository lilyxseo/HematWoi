import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  Circle,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { InsightItem } from "./InsightList";

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

interface FinancialHealthScoreCardProps {
  score: number;
  label: string;
  subtitle: string;
  comparison?: ScoreComparison | null;
  cashflow: string;
  savingsRate: string;
  debtRatio: string;
  budgetOver: string;
  insights: InsightItem[];
  isEmpty: boolean;
}

const INSIGHT_PRIORITY: Record<InsightItem["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export default function FinancialHealthScoreCard({
  score,
  label,
  subtitle,
  comparison,
  cashflow,
  savingsRate,
  debtRatio,
  budgetOver,
  insights,
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

  const nextSteps = [...insights]
    .sort((a, b) => INSIGHT_PRIORITY[b.severity] - INSIGHT_PRIORITY[a.severity])
    .slice(0, 2);

  const TrendIcon =
    comparison?.direction === "up"
      ? TrendingUp
      : comparison?.direction === "down"
        ? TrendingDown
        : Minus;

  const trendTone =
    comparison?.direction === "up"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
      : comparison?.direction === "down"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
        : "border-border bg-surface-2 text-muted";

  return (
    <div className="rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-sm">
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
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
              trendTone
            )}
          >
            {TrendIcon ? (
              <span className="flex h-4 w-4 items-center justify-center">
                <TrendIcon className="h-4 w-4" />
              </span>
            ) : null}
            <span>
              {comparison.label}:{" "}
              {comparison.direction === "down"
                ? "-"
                : comparison.direction === "flat"
                  ? ""
                  : "+"}
              {comparison.value.toFixed(1)}%
            </span>
          </div>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-subtle bg-surface-2/40 p-6 text-center">
          <Circle className="h-8 w-8 text-muted" />
          <div>
            <p className="text-sm font-semibold text-text">
              Belum ada data untuk periode ini
            </p>
            <p className="mt-1 text-sm text-muted">
              Tambahkan transaksi agar skor finansial dan insight bisa dihitung.
            </p>
          </div>
          <Link
            to="/transaction/add"
            className="inline-flex items-center justify-center rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/25"
          >
            Tambah transaksi
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[auto,1fr] md:items-start">
          <div className="flex flex-col items-center gap-4">
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
                <div className="text-3xl font-bold text-text">{safeScore}</div>
                <div className="text-xs text-muted">/ 100</div>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase text-muted">Kondisi</p>
              <p className="text-xl font-semibold text-text">{label}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted">Ringkasan kondisi</p>
              <p className="mt-1 text-sm text-muted">
                {safeScore >= 80 &&
                  "Pertahankan kebiasaan finansialmu. Kamu sudah di jalur yang tepat."}
                {safeScore >= 60 &&
                  safeScore < 80 &&
                  "Kondisi keuangan cukup stabil, tetap jaga disiplin pengeluaran."}
                {safeScore >= 40 &&
                  safeScore < 60 &&
                  "Mulai cek pos pengeluaran utama agar cashflow tetap aman."}
                {safeScore < 40 &&
                  "Perlu segera perbaiki cashflow dan kendalikan cicilan."}
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-text">
                Quick metrics
              </p>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-border-subtle bg-surface-2/40 px-3 py-2">
                  <p className="text-xs uppercase text-muted">Cashflow</p>
                  <p className="text-sm font-semibold text-text">
                    {cashflow}
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-2/40 px-3 py-2">
                  <p className="text-xs uppercase text-muted">
                    Savings Rate
                  </p>
                  <p className="text-sm font-semibold text-text">
                    {savingsRate}
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-2/40 px-3 py-2">
                  <p className="text-xs uppercase text-muted">Debt Ratio</p>
                  <p className="text-sm font-semibold text-text">
                    {debtRatio}
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-surface-2/40 px-3 py-2">
                  <p className="text-xs uppercase text-muted">
                    Over-budget
                  </p>
                  <p className="text-sm font-semibold text-text">
                    {budgetOver}
                  </p>
                </div>
              </div>
            </div>

            {nextSteps.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-text">
                  What to do next
                </p>
                <ul className="mt-2 space-y-2 text-sm text-muted">
                  {nextSteps.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary/60" />
                      <Link
                        to={item.ctaHref}
                        className="text-sm font-medium text-text transition hover:text-primary"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
