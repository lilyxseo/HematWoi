import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { DailyDigestData, DailyDigestMode } from "../hooks/useDailyDigest";
import { formatCurrency } from "../lib/format";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";

type DailyDigestProps = {
  open: boolean;
  mode: DailyDigestMode;
  data: DailyDigestData | null;
  onAcknowledge: () => void;
  onDismiss: () => void;
  onReopen: () => void;
};

const numberFormatter = new Intl.NumberFormat("id-ID");

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function DailyDigest({
  open,
  mode,
  data,
  onAcknowledge,
  onDismiss,
  onReopen,
}: DailyDigestProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useLockBodyScroll(open && mode === "modal");

  useEffect(() => {
    if (!open || mode !== "modal") return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      dialog.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])"
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !dialog.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      const autofocus = dialog.querySelector<HTMLElement>("[data-autofocus='true']");
      if (autofocus) {
        autofocus.focus();
        return;
      }
      const focusable = getFocusable();
      focusable[0]?.focus();
    }, 30);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, mode, onDismiss]);

  const diffColor = useMemo(() => {
    if (!data) return "text-muted";
    if (data.differenceDirection === "up") return "text-danger";
    if (data.differenceDirection === "down") return "text-success";
    return "text-muted";
  }, [data]);

  if (!open || !data) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[110] flex flex-col bg-black/40 px-4 py-6 sm:py-10">
      <div
        role="presentation"
        className="absolute inset-0"
        onClick={onDismiss}
      />
      <div className="relative z-[111] mx-auto flex w-full max-w-xl flex-1 items-end justify-center sm:items-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-digest-title"
          className="relative flex h-full w-full flex-col overflow-y-auto rounded-3xl border border-border/60 bg-surface-1/95 p-6 text-text shadow-xl backdrop-blur sm:h-auto sm:max-h-[90vh]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Daily Digest</p>
              <h2 id="daily-digest-title" className="mt-1 text-2xl font-semibold leading-snug">
                Ringkasan kemarin
              </h2>
              <p className="text-sm text-muted">{data.dateLabel}</p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
              aria-label="Tampilkan sebagai banner"
            >
              ×
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-3xl border border-border bg-surface-1/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total pengeluaran</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(data.totalSpent)}</p>
              <p className="text-sm text-muted">{numberFormatter.format(data.transactionCount)} transaksi</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-surface-1/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rata-rata 7 hari</p>
                <p className="mt-2 text-lg font-semibold">{formatCurrency(data.average7Day)}</p>
                <p className={classNames("text-xs font-semibold", diffColor)}>
                  {data.differenceLabel} vs rata-rata
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-surface-1/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Jumlah transaksi</p>
                <p className="mt-2 text-lg font-semibold">{numberFormatter.format(data.transactionCount)}</p>
                <p className="text-xs text-muted">di hari kemarin</p>
              </div>
            </div>

            {data.topCategories.length ? (
              <div className="rounded-3xl border border-border bg-surface-1/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Kategori teratas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.topCategories.map((item) => (
                    <span
                      key={`cat-${item.name}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-xs font-medium text-text"
                    >
                      <span>{item.name}</span>
                      <span className="text-[11px] font-semibold text-muted">
                        {formatCurrency(item.amount)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {data.topMerchants.length ? (
              <div className="rounded-3xl border border-border bg-surface-1/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Merchant teratas</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.topMerchants.map((item) => (
                    <span
                      key={`merchant-${item.name}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-xs font-medium text-text"
                    >
                      <span>{item.name}</span>
                      <span className="text-[11px] font-semibold text-muted">
                        {formatCurrency(item.amount)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="text-sm leading-relaxed text-muted">{data.message}</p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-transparent px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] sm:w-auto"
            >
              Lihat nanti
            </button>
            <button
              type="button"
              data-autofocus="true"
              onClick={onAcknowledge}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] sm:w-auto"
            >
              Oke, mengerti
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const bannerContent = (
    <div className="fixed inset-x-4 bottom-6 z-[90] sm:left-auto sm:right-8 sm:w-[360px]">
      <div className="flex items-start gap-3 rounded-3xl border border-border bg-surface-1/95 px-4 py-3 text-sm text-text shadow-xl backdrop-blur">
        <div className="flex-1">
          <p className="text-sm font-semibold">Daily Digest</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{data.message}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={onReopen}
            className="text-xs font-semibold text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            Lihat
          </button>
          <button
            type="button"
            onClick={onAcknowledge}
            className="text-xs font-medium text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );

  if (mode === "banner") {
    return createPortal(bannerContent, document.body);
  }

  return createPortal(modalContent, document.body);
}
