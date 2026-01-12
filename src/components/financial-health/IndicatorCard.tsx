import clsx from "clsx";
import { useState } from "react";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

interface IndicatorCardProps {
  title: string;
  icon: ReactNode;
  value: string;
  status: string;
  score: number;
  tooltip: string;
  description: string;
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
  description,
}: IndicatorCardProps) {
  const [open, setOpen] = useState(false);

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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpen((prev) => !prev)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-muted transition hover:border-primary hover:text-primary"
                  aria-label={tooltip}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
                {open && (
                  <div className="absolute left-1/2 top-8 z-10 w-56 -translate-x-1/2 rounded-xl border border-border-subtle bg-surface-1 p-3 text-xs text-muted shadow-lg">
                    <p className="font-medium text-text">{tooltip}</p>
                    <p className="mt-1">{description}</p>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="mt-2 inline-flex text-[11px] font-semibold text-primary"
                    >
                      Tutup
                    </button>
                  </div>
                )}
              </div>
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
