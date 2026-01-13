import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

interface IndicatorCardProps {
  title: string;
  icon: ReactNode;
  value: string;
  status: string;
  score: number | null;
  infoTitle: string;
  infoPoints: string[];
}

function getScoreTone(score: number | null) {
  if (score == null) return "text-muted";
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
  infoTitle,
  infoPoints,
}: IndicatorCardProps) {
  const [open, setOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const tooltipId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouch(mediaQuery.matches);
    update();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [open]);

  const handleMouseEnter = () => {
    if (isTouch) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setOpen(true), 150);
  };

  const handleMouseLeave = () => {
    if (isTouch) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setOpen(false);
  };

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
              <div className="relative" ref={containerRef}>
                <button
                  type="button"
                  onClick={() => setOpen((prev) => (isTouch ? !prev : prev))}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onFocus={handleMouseEnter}
                  onBlur={handleMouseLeave}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-muted transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={`Info ${infoTitle}`}
                  aria-expanded={open}
                  aria-controls={open ? tooltipId : undefined}
                >
                  <Info className="h-4 w-4" />
                </button>
                {open && (
                  <div
                    id={tooltipId}
                    role={isTouch ? "dialog" : "tooltip"}
                    aria-live="polite"
                    className="absolute left-1/2 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-border-subtle bg-surface-1 p-3 text-xs text-muted shadow-xl md:left-auto md:right-0 md:translate-x-0"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-text">{infoTitle}</p>
                      {isTouch ? (
                        <button
                          type="button"
                          onClick={() => setOpen(false)}
                          className="text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          Tutup
                        </button>
                      ) : null}
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs text-muted">
                      {infoPoints.map((point) => (
                        <li key={point} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/60" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted">{status}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={clsx("text-sm font-semibold", getScoreTone(score))}>
            {score == null ? "—" : Math.round(score)}
          </p>
          <p className="text-[11px] text-muted">Skor</p>
        </div>
      </div>
      <div className="mt-4 text-lg font-semibold text-text">{value}</div>
    </div>
  );
}
