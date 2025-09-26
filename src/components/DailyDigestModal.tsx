import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

export interface DailyDigestCategoryHighlight {
  name: string;
  amount: number;
}

export interface DailyDigestUpcomingItem {
  name: string;
  amount: number | null;
  dueInDays: number;
  dueDateLabel: string;
}

export interface DailyDigestMonthStatus {
  label: string;
  pct: number;
  status: 'ok' | 'warning' | 'danger';
  planned?: number | null;
  actual?: number | null;
}

export interface DailyDigestTodaySnapshot {
  dateLabel: string;
  expense: number;
  income: number;
  net: number;
  transactionCount: number;
}

export interface DailyDigestModalContent {
  summary?: string;
  balance: {
    total: number;
  };
  today: DailyDigestTodaySnapshot;
  month?: {
    expense: number;
    status: DailyDigestMonthStatus | null;
  };
  topCategories: DailyDigestCategoryHighlight[];
  upcoming: DailyDigestUpcomingItem[];
}

interface DailyDigestModalProps {
  open: boolean;
  onClose: () => void;
  data: DailyDigestModalContent | null;
  loading?: boolean;
}

const focusableSelectors = [
  'a[href]',
  'button',
  'textarea',
  'input[type="text"]',
  'input[type="email"]',
  'input[type="number"]',
  'input[type="search"]',
  'input[type="tel"]',
  'input[type="url"]',
  'input[type="date"]',
  'select',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const CURRENCY = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

function formatCurrency(value: number | null | undefined): string {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return CURRENCY.format(Math.round(numeric));
}

function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(Math.abs(value));
  return `${rounded}%`;
}

function formatDays(value: number): string {
  if (value <= 0) return 'Hari ini';
  if (value === 1) return 'Besok';
  return `Dalam ${value} hari`;
}

function badgeTone(status: DailyDigestMonthStatus['status']): string {
  switch (status) {
    case 'danger':
      return 'border-rose-400/40 bg-rose-500/10 text-rose-500';
    case 'warning':
      return 'border-amber-400/40 bg-amber-500/10 text-amber-600';
    default:
      return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-500';
  }
}

export default function DailyDigestModal({ open, onClose, data, loading = false }: DailyDigestModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  useLockBodyScroll(open);

  const handleBackdropMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        event.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const container = dialogRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors),
      ).filter((el) => !el.hasAttribute('disabled'));
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

    document.addEventListener('keydown', handleKeyDown);
    const timer = window.setTimeout(() => {
      if (primaryActionRef.current) {
        primaryActionRef.current.focus();
        return;
      }
      const container = dialogRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(focusableSelectors);
      focusables[0]?.focus();
    }, 40);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  const content = useMemo(() => {
    if (!data) return null;

    const today = data.today;
    const month = data.month?.status;
    const upcoming = data.upcoming.slice(0, 4);

    return (
      <div className="space-y-6">
        <section>
          <div className="text-xs uppercase tracking-wide text-muted">{today.dateLabel}</div>
          <h2 id="daily-digest-title" className="mt-2 text-2xl font-semibold text-text">
            Daily Digest
          </h2>
          {data.summary ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">{data.summary}</p>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-border/60 bg-surface-1/95 p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Saldo Total</h3>
            <p className="mt-2 text-2xl font-semibold text-text">{formatCurrency(data.balance.total)}</p>
            <p className="mt-1 text-xs text-muted">Total aset bersih yang tercatat.</p>
          </article>

          <article className="rounded-2xl border border-border/60 bg-surface-1/95 p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Aktivitas Hari Ini</h3>
            <div className="mt-3 space-y-2 text-sm text-text">
              <div className="flex items-center justify-between">
                <span>Pengeluaran</span>
                <span className="font-semibold text-rose-500">{formatCurrency(today.expense)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pemasukan</span>
                <span className="font-semibold text-emerald-500">{formatCurrency(today.income)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{today.transactionCount} transaksi</span>
                <span>Netto {formatCurrency(today.net)}</span>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border/60 bg-surface-1/95 p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">MTD vs Anggaran</h3>
            {month ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text">{month.label}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeTone(
                      month.status,
                    )}`}
                  >
                    {formatPercentage(month.pct)}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {month.actual !== null && month.planned !== null
                    ? `${formatCurrency(month.actual)} dari ${formatCurrency(month.planned)} terpakai.`
                    : 'Pantau alokasi anggaran bulan ini.'}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Belum ada data anggaran bulan ini.</p>
            )}
          </article>

          <article className="rounded-2xl border border-border/60 bg-surface-1/95 p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Kategori Teratas</h3>
            {data.topCategories.length ? (
              <ul className="mt-3 space-y-2 text-sm text-text">
                {data.topCategories.map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="whitespace-nowrap text-brand">{formatCurrency(item.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Belum ada transaksi kategori teratas.</p>
            )}
          </article>
        </section>

        <section className="rounded-2xl border border-border/60 bg-surface-1/95 p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Tagihan 7 Hari Mendatang</h3>
          {upcoming.length ? (
            <ul className="mt-3 space-y-2 text-sm text-text">
              {upcoming.map((item) => (
                <li key={`${item.name}-${item.dueDateLabel}`} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted">{item.dueDateLabel}</p>
                  </div>
                  <div className="flex flex-col items-end text-right text-xs text-muted">
                    <span className="text-sm font-semibold text-text">
                      {item.amount !== null ? formatCurrency(item.amount) : '—'}
                    </span>
                    <span>{formatDays(item.dueInDays)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Tidak ada tagihan jatuh tempo dalam 7 hari.</p>
          )}
        </section>
      </div>
    );
  }, [data]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 px-4 py-6"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-digest-title"
        className="relative mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-surface/95 p-6 text-text shadow-2xl backdrop-blur md:h-auto md:max-h-[85vh] md:p-8"
      >
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:bg-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          ×
        </button>
        <div className="mt-6 flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/60 border-t-brand" aria-hidden />
              <span className="text-xs font-medium text-muted">Memuat ringkasan harian…</span>
            </div>
          ) : content ? (
            content
          ) : (
            <p className="text-sm text-muted">Ringkasan harian belum tersedia.</p>
          )}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            ref={primaryActionRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-semibold text-brand-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            Oke, mengerti
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
