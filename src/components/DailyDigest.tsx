import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { DailyDigestData } from "../hooks/useDailyDigest";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";

interface DailyDigestProps {
  open: boolean;
  data: DailyDigestData | null;
  variant?: "modal" | "banner";
  onClose: () => void;
}

const focusableSelectors = [
  "a[href]",
  "button",
  "textarea",
  "input[type=\"text\"]",
  "input[type=\"email\"]",
  "input[type=\"number\"]",
  "input[type=\"search\"]",
  "input[type=\"tel\"]",
  "input[type=\"url\"]",
  "input[type=\"date\"]",
  "select",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatPercentage(direction: DailyDigestData["diffDirection"], value: number): string {
  const rounded = Math.round(Math.abs(value));
  if (direction === "flat") return "0%";
  return `${direction === "down" ? "-" : "+"}${rounded}%`;
}

export default function DailyDigest({ open, data, variant = "modal", onClose }: DailyDigestProps) {
  const [displayMode, setDisplayMode] = useState<"modal" | "banner">(variant);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const okButtonRef = useRef<HTMLButtonElement | null>(null);
  const handleBackdropPointerDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        event.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) {
      setDisplayMode(variant);
    }
  }, [open, variant]);

  useLockBodyScroll(open && displayMode === "modal");

  useEffect(() => {
    if (!open || displayMode !== "modal") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const container = modalRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!focusables.length) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const timer = window.setTimeout(() => {
      if (okButtonRef.current) {
        okButtonRef.current.focus();
        return;
      }
      const container = modalRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(focusableSelectors);
      focusables[0]?.focus();
    }, 30);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [displayMode, onClose, open]);

  const highlights = useMemo<DailyDigestData["topCategories"]>(() => {
    if (!data) return [];
    if (data.topCategories.length) return data.topCategories;
    return data.topMerchants;
  }, [data]);

  if (!open || !data) return null;

  const content = (
    <div className="text-sm text-muted">
      <div className="text-xs uppercase tracking-wide text-muted">{data.yesterdayLabel}</div>
      <h2 id="daily-digest-title" className="mt-2 text-2xl font-semibold text-text">
        Daily Digest
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.summary}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-surface-1/95 p-4">
          <div className="text-xs font-medium uppercase text-muted">Total Pengeluaran</div>
          <div className="mt-2 text-xl font-semibold text-brand">{formatCurrency(data.totalSpent)}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface-1/95 p-4">
          <div className="text-xs font-medium uppercase text-muted">Jumlah Transaksi</div>
          <div className="mt-2 text-xl font-semibold text-text">{data.transactionCount}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface-1/95 p-4">
          <div className="text-xs font-medium uppercase text-muted">Rata-rata 7 Hari</div>
          <div className="mt-2 text-xl font-semibold text-text">{formatCurrency(data.average7Day)}</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface-1/95 p-4">
          <div className="text-xs font-medium uppercase text-muted">Perbandingan</div>
          <div
            className={clsx("mt-2 text-xl font-semibold", {
              "text-danger": data.diffDirection === "up",
              "text-success": data.diffDirection === "down",
              "text-text": data.diffDirection === "flat",
            })}
          >
            {formatPercentage(data.diffDirection, data.diffPercent)}
          </div>
          <div className="text-xs text-muted">{data.comparisonSentence}</div>
        </div>
      </div>

      {highlights.length ? (
        <div className="mt-6 rounded-2xl border border-border/60 bg-surface-1/95 p-4">
          <div className="text-xs font-medium uppercase text-muted">
            {data.topCategories.length ? "Top Kategori" : "Top Merchant"}
          </div>
          <ul className="mt-3 space-y-2 text-sm text-text">
            {highlights.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-2">
                <span>{item.name}</span>
                <span className="font-medium text-brand">{formatCurrency(item.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <button
          ref={okButtonRef}
          type="button"
          onClick={onClose}
          className="inline-flex h-[44px] items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          Oke, mengerti
        </button>
        <button
          type="button"
          onClick={() => setDisplayMode("banner")}
          className="inline-flex h-[44px] items-center justify-center rounded-xl border border-border bg-surface-1 px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          Tampilkan ringkasan mini
        </button>
      </div>
    </div>
  );

  if (displayMode === "banner") {
    return createPortal(
      <div className="fixed bottom-4 left-1/2 z-[95] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-border/60 bg-surface-1/95 p-4 shadow-xl backdrop-blur">
        <div className="text-xs uppercase text-muted">{data.yesterdayLabel}</div>
        <div className="mt-1 text-base font-semibold text-text">Daily Digest</div>
        <p className="mt-2 text-sm text-muted-foreground">{data.summary}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[38px] items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            Oke, mengerti
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode("modal")}
            className="inline-flex h-[38px] items-center justify-center rounded-lg border border-border bg-surface-1 px-3 text-xs font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            Lihat detail
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-black/50 px-4 py-6 md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-digest-title"
      onMouseDown={handleBackdropPointerDown}
    >
      <div
        ref={modalRef}
        className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-surface-1/95 p-6 text-text shadow-2xl backdrop-blur md:h-auto md:max-h-[85vh] md:p-8"
      >
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          ×
        </button>
        <div className="mt-2 flex-1 overflow-y-auto pr-1">
          {content}
        </div>
      </div>
    </div>,
    document.body,
  );
}
