import { useEffect, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
import clsx from "clsx";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Plus,
  X,
} from "lucide-react";
import {
  type DailyDigestData,
  type DailyDigestBudgetCategory,
  type DailyDigestUpcomingItem,
  type TrendDirection,
} from "../hooks/useDailyDigest";
import { useLockBodyScroll } from "../hooks/useLockBodyScroll";
import { formatCurrency } from "../lib/format";

interface DailyDigestModalProps {
  open: boolean;
  data?: DailyDigestData;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClose: () => void;
  onAddTransaction?: () => void;
  onViewMonthly?: () => void;
  onSelectCategory?: (categoryId: string | null, name: string) => void;
}

const focusableSelectors = [
  "a[href]",
  "button:not([disabled])",
  "textarea",
  "input[type='text']",
  "input[type='email']",
  "input[type='number']",
  "input[type='search']",
  "input[type='tel']",
  "input[type='url']",
  "input[type='date']",
  "select",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const percentFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function formatIdr(value: number): string {
  return formatCurrency(Math.round(value ?? 0), "IDR");
}

function formatPercent(value: number | null | undefined, { signed = false } = {}): string {
  if (!Number.isFinite(value ?? NaN)) {
    return signed ? "+0%" : "0%";
  }
  const numeric = value ?? 0;
  const body = percentFormatter.format(Math.abs(numeric));
  if (signed) {
    if (numeric > 0) return `+${body}%`;
    if (numeric < 0) return `-${body}%`;
    return "0%";
  }
  return `${body}%`;
}

function trendTone(direction: TrendDirection): string {
  switch (direction) {
    case "up":
      return "bg-emerald-500/15 text-emerald-300";
    case "down":
      return "bg-rose-500/15 text-rose-300";
    default:
      return "bg-slate-700/60 text-slate-300";
  }
}

function trendIcon(direction: TrendDirection) {
  if (direction === "down") return <ArrowDownRight className="h-4 w-4" aria-hidden />;
  return <ArrowUpRight className="h-4 w-4" aria-hidden />;
}

function statusTone(status: DailyDigestBudgetCategory["status"]): string {
  if (status === "danger") return "text-rose-300";
  if (status === "warning") return "text-amber-300";
  return "text-slate-300";
}

function statusBarTone(status: DailyDigestBudgetCategory["status"]): string {
  if (status === "danger") return "bg-rose-500/70";
  if (status === "warning") return "bg-amber-400/70";
  return "bg-emerald-500/70";
}

function UpcomingList({ items }: { items: DailyDigestUpcomingItem[] }) {
  if (!items.length) {
    return <p className="text-xs text-slate-400">Tidak ada jadwal dalam 7 hari ke depan.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-200">{item.name}</p>
            <p className="text-xs text-slate-400">
              {dateFormatter.format(new Date(`${item.dueDate}T00:00:00`))}
              {" · "}
              {item.type === "subscription" ? "Langganan" : "Hutang"}
            </p>
          </div>
          <span
            className={clsx(
              "shrink-0 font-mono text-sm",
              item.type === "subscription" ? "text-emerald-300" : "text-amber-300",
            )}
          >
            {formatIdr(item.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BudgetHighlights({ items }: { items: DailyDigestBudgetCategory[] }) {
  if (!items.length) {
    return <p className="text-xs text-slate-400">Semua kategori masih aman 🎉</p>;
  }
  return (
    <ul className="space-y-2 text-xs">
      {items.map((item) => (
        <li key={item.id ?? item.name} className="flex items-center justify-between gap-3">
          <span className="truncate text-slate-300">{item.name}</span>
          <span className={clsx("font-semibold", statusTone(item.status))}>{formatPercent(item.pct)}</span>
        </li>
      ))}
    </ul>
  );
}

function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-4">
      <div className="h-3 w-24 rounded-full bg-slate-800/70" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: deterministic skeleton
            key={index}
            className="h-4 w-full animate-pulse rounded bg-slate-800/60"
          />
        ))}
      </div>
    </div>
  );
}

export default function DailyDigestModal({
  open,
  data,
  loading = false,
  error,
  onRetry,
  onClose,
  onAddTransaction,
  onViewMonthly,
  onSelectCategory,
}: DailyDigestModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
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
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      titleRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      onClose();
    }
  };

  const showSkeleton = loading && !data;
  const budgetHighlights = useMemo(() => {
    if (!data) return [];
    return data.budgets.categories.filter((item) => item.status !== "safe").slice(0, 3);
  }, [data]);

  const topCategories = useMemo(() => data?.topCategories ?? [], [data]);
  const upcoming = useMemo(() => data?.upcoming ?? [], [data]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      onMouseDown={handleBackdrop}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-digest-title"
        className="relative w-full max-w-lg rounded-2xl bg-slate-900 p-4 text-slate-100 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.85)] ring-1 ring-slate-800 md:p-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup ringkasan"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="pr-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Ringkasan Hari Ini</p>
          <h2
            id="daily-digest-title"
            ref={titleRef}
            tabIndex={-1}
            className="mt-1 text-2xl font-semibold text-white focus:outline-none"
          >
            Daily Digest
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Kilas cepat kondisi finansial harianmu.
          </p>
        </div>

        {error ? (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {error}
            </span>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center rounded-full bg-rose-500/20 px-3 py-1 text-rose-100 transition hover:bg-rose-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
              >
                Coba lagi
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {showSkeleton ? (
            <>
              <SkeletonCard lines={4} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={4} />
              <SkeletonCard lines={4} />
              <SkeletonCard lines={3} />
            </>
          ) : (
            <>
              <section className="sm:col-span-2 rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                <header className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Saldo Ringkas</p>
                    <p className="mt-1 text-3xl font-semibold text-white">
                      <span className="font-mono">{formatIdr(data?.balance.total ?? 0)}</span>
                    </p>
                  </div>
                  <span className={clsx("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", trendTone(data?.balance.direction ?? "flat"))}>
                    {trendIcon(data?.balance.direction ?? "flat")}
                    <span className="font-mono">
                      {formatIdr(Math.abs(data?.balance.diff ?? 0))}
                    </span>
                  </span>
                </header>
                <p className="mt-3 text-xs text-slate-400">
                  {data?.balance.changePercent == null
                    ? "Perbandingan saldo vs kemarin"
                    : `${formatPercent(data.balance.changePercent, { signed: true })} vs kemarin`}
                </p>
              </section>

              <section className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Pengeluaran Hari Ini</p>
                <p className="mt-2 text-2xl font-semibold text-rose-200">
                  <span className="font-mono">{formatIdr(data?.today.expense ?? 0)}</span>
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {data?.today.differencePercent == null
                    ? "vs rata-rata harian bulan ini"
                    : data.today.difference > 0
                    ? `${formatPercent(data.today.differencePercent, { signed: true })} di atas rata-rata harian bulan ini`
                    : data.today.difference < 0
                    ? `${formatPercent(data.today.differencePercent, { signed: true })} di bawah rata-rata harian bulan ini`
                    : "Setara dengan rata-rata harian bulan ini"}
                </p>
                {data ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Rata-rata {formatIdr(data.today.average)} per hari bulan ini.
                  </p>
                ) : null}
              </section>

              <section className="rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">MTD vs Budget</p>
                <p className="mt-2 text-lg font-semibold text-slate-100">
                  <span className="font-mono">{formatIdr(data?.budgets.spent ?? 0)}</span>
                  <span className="text-xs font-normal text-slate-400"> / {formatIdr(data?.budgets.planned ?? 0)}</span>
                </p>
                <div className="mt-3 h-2 rounded-full bg-slate-800/70">
                  <div
                    className={clsx("h-2 rounded-full transition-all", statusBarTone(data?.budgets.status ?? "safe"))}
                    style={{ width: `${Math.min(Math.max(data?.budgets.pct ?? 0, 0), 130)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {data ? `${formatPercent(data.budgets.pct)} dari total budget bulan ini.` : ""}
                </p>
                <div className="mt-3">
                  <BudgetHighlights items={budgetHighlights} />
                </div>
              </section>

              <section className="sm:col-span-2 rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Top 3 Kategori (MTD)</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topCategories.length ? (
                    topCategories.map((item) => {
                      const content = (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono text-sm text-slate-100">{formatIdr(item.amount)}</span>
                          <span className="rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                            {formatPercent(item.pct)}
                          </span>
                          <span className="truncate text-xs text-slate-300">{item.name}</span>
                        </span>
                      );
                      if (!onSelectCategory) {
                        return (
                          <span
                            key={item.id ?? item.name}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/40 px-3 py-1.5"
                          >
                            {content}
                          </span>
                        );
                      }
                      return (
                        <button
                          key={item.id ?? item.name}
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectCategory(item.id ?? null, item.name);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/40 px-3 py-1.5 text-left text-slate-200 transition hover:border-[var(--accent)]/60 hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        >
                          {content}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400">Belum ada pengeluaran bulan ini.</p>
                  )}
                </div>
              </section>

              <section className="sm:col-span-2 rounded-xl border border-slate-800/70 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[var(--accent)]" aria-hidden />
                  <p className="text-xs uppercase tracking-wide text-slate-400">Upcoming 7 Hari</p>
                </div>
                <div className="mt-3">
                  <UpcomingList items={upcoming} />
                </div>
              </section>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddTransaction?.();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-[var(--accent)]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Tambah Transaksi
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewMonthly?.();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Detail Bulanan
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-slate-400 transition hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
