import clsx from "clsx";
import type { ReactNode } from "react";

interface IndicatorCardProps {
  title: string;
  icon: ReactNode;
  value: string;
  status: string;
  score: number;
  tooltip: string;
}

function getScoreTone(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-lime-600";
  if (score >= 40) return "text-amber-600";
  return "text-rose-600";
}

export default function IndicatorCard({
  title,
  icon,
  value,
  status,
  score,
  tooltip,
}: IndicatorCardProps) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-primary">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text">{title}</h3>
              <span
                className="text-xs text-muted"
                title={tooltip}
                aria-label={tooltip}
              >
                ⓘ
              </span>
            </div>
            <p className="text-xs text-muted">{status}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={clsx("text-sm font-semibold", getScoreTone(score))}>
            {Math.round(score)}
          </p>
          <p className="text-[11px] text-muted">Skor</p>
        </div>
      </div>
      <div className="mt-4 text-lg font-semibold text-text">{value}</div>
    </div>
  );
}
