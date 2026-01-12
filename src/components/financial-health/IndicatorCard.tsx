import clsx from "clsx";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import InfoPopover from "./InfoPopover";

interface IndicatorCardProps {
  title: string;
  icon: ReactNode;
  value: string;
  status: string;
  score: number;
  tooltip: string;
  bullets: string[];
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
  bullets,
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
              <InfoPopover
                title={title}
                tooltip={tooltip}
                bullets={bullets}
                triggerLabel={`Info ${title}`}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-muted transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <Info className="h-4 w-4" />
                </span>
              </InfoPopover>
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
