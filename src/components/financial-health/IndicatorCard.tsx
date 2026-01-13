import clsx from "clsx";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface IndicatorCardProps {
  title: string;
  icon: ReactNode;
  value: ReactNode;
  secondaryValue?: ReactNode;
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
  secondaryValue,
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
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom";
  } | null>(null);

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

  const updateTooltipPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth ?? 288;
    const tooltipHeight = tooltipRef.current?.offsetHeight ?? 160;
    const spacing = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let top = rect.bottom + spacing;
    let placement: "top" | "bottom" = "bottom";

    if (top + tooltipHeight > viewportHeight && rect.top - spacing - tooltipHeight > 0) {
      top = rect.top - tooltipHeight - spacing;
      placement = "top";
    }

    const desiredLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    const left = Math.min(
      Math.max(desiredLeft, 12),
      Math.max(12, viewportWidth - tooltipWidth - 12)
    );

    setTooltipPosition({ top, left, placement });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateTooltipPosition();
    const handleScroll = () => updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updateTooltipPosition]);

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
                {open && tooltipPosition
                  ? createPortal(
                      <div
                        id={tooltipId}
                        ref={tooltipRef}
                        role={isTouch ? "dialog" : "tooltip"}
                        aria-live="polite"
                        className="fixed z-[60] w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border-subtle bg-surface-1 p-3 text-xs text-muted shadow-xl"
                        style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
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
                        <div
                          className={clsx(
                            "absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-surface-1",
                            tooltipPosition.placement === "bottom"
                              ? "-top-1 border-l border-t border-border-subtle"
                              : "-bottom-1 border-b border-r border-border-subtle"
                          )}
                        />
                      </div>,
                      document.body
                    )
                  : null}
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
      <div className="mt-4 space-y-1">
        <div className="text-lg font-semibold text-text">{value}</div>
        {secondaryValue ? <div className="text-sm text-muted">{secondaryValue}</div> : null}
      </div>
    </div>
  );
}
