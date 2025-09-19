import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useLocation } from "react-router-dom";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";

interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function MobileDrawer({
  open,
  onOpenChange,
  children,
  ariaLabel = "Navigasi",
}: MobileDrawerProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElement = useRef<Element | null>(null);
  const location = useLocation();

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    lastFocusedElement.current = document.activeElement;
    const panel = panelRef.current;
    if (!panel) return;
    const focusTarget = panel.querySelector<HTMLElement>(
      "[data-autofocus='true']"
    );
    const focusable = focusTarget ?? panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    onOpenChange(false);
  }, [location.pathname, onOpenChange, open]);

  useEffect(() => {
    if (open) return;
    const toRestore = lastFocusedElement.current as HTMLElement | null;
    toRestore?.focus?.();
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        ref={overlayRef}
        className={clsx(
          "fixed inset-0 z-[60] bg-black/40 backdrop-blur transition-opacity duration-200 supports-[backdrop-filter]:bg-black/30",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={clsx(
          "fixed left-0 top-0 z-[70] flex h-[100dvh] w-[84vw] max-w-[360px] flex-col overflow-hidden bg-surface-1 text-text shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}
