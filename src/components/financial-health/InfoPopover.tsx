import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

interface InfoPopoverProps {
  title: string;
  tooltip: string;
  bullets: string[];
  triggerLabel: string;
  children: ReactNode;
}

const TOOLTIP_DELAY = 150;

function useHoverCapable() {
  const [hover, setHover] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(hover: hover)");
    const update = () => setHover(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);
  return hover;
}

export default function InfoPopover({
  title,
  tooltip,
  bullets,
  triggerLabel,
  children,
}: InfoPopoverProps) {
  const id = useId();
  const isHover = useHoverCapable();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isHover) return;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (hovered) {
      timeoutRef.current = window.setTimeout(() => setOpen(true), TOOLTIP_DELAY);
    } else {
      setOpen(false);
    }
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [hovered, isHover]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (!isHover) setOpen((prev) => !prev);
        }}
        onFocus={() => {
          if (isHover) setHovered(true);
        }}
        onBlur={() => {
          if (isHover) setHovered(false);
        }}
        className="focus-visible:outline-none"
      >
        {children}
      </button>
      {open && (
        <div
          id={id}
          role={isHover ? "tooltip" : "dialog"}
          className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-2xl border border-border-subtle bg-surface-1 p-4 text-xs text-muted shadow-lg"
        >
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="mt-1 text-xs text-muted">{tooltip}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {!isHover && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex text-[11px] font-semibold text-primary"
            >
              Tutup
            </button>
          )}
        </div>
      )}
    </div>
  );
}
