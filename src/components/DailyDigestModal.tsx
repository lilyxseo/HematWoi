import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DailyDigestModalData } from '../hooks/useShowDigestOnLogin';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface DailyDigestModalProps {
  open: boolean;
  data: DailyDigestModalData | null;
  loading?: boolean;
  onClose: () => void;
}

const focusableSelectors = [
  'a[href]',
  'button',
  'textarea',
  'input',
  'select',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatDaysLabel(days: number): string {
  if (days <= 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  return `Dalam ${days} hari`;
}

export default function DailyDigestModal({ open, data, loading = false, onClose }: DailyDigestModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelectors),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusables.length === 0) {
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
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
        return;
      }
      const container = containerRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(focusableSelectors);
      focusables[0]?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        event.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const showContent = !loading && Boolean(data);

  const content = showContent ? (
    <>
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{data!.todayLabel}</p>
        <h2 id="daily-digest-modal-title" className="text-2xl font-semibold text-text">Daily Digest</h2>
        <p className="text-sm text-muted">
          Ringkasan keuanganmu untuk membantu memulai hari dengan fokus.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Saldo total</div>
          <div className="mt-2 text-2xl font-semibold text-text">{formatCurrency(data!.balance)}</div>
          <p className="mt-1 text-xs text-muted">Per {data!.todayLabel}</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Aktivitas hari ini</div>
          <div className="mt-2 flex items-baseline gap-2 text-xl font-semibold text-text">
            <span className="text-danger">-{formatCurrency(data!.todayExpense)}</span>
            <span className="text-muted">/</span>
            <span className="text-success">+{formatCurrency(data!.todayIncome)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {data!.todayCount} transaksi · Net {formatCurrency(data!.todayNet)}
          </p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Top pengeluaran hari ini</div>
          {data!.topTodayExpenses.length ? (
            <ul className="mt-3 space-y-2 text-sm text-text">
              {data!.topTodayExpenses.map((item) => (
                <li key={item.name} className="flex items-center justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className="font-semibold text-danger">-{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Belum ada pengeluaran yang tercatat hari ini.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Pengeluaran kemarin</div>
          <div className="mt-2 text-2xl font-semibold text-danger">-{formatCurrency(data!.yesterdayExpense)}</div>
          {data!.yesterdayCount > 0 ? (
            <p className="mt-2 text-xs text-muted">{data!.yesterdayCount} transaksi tercatat kemarin.</p>
          ) : (
            <p className="mt-2 text-sm text-muted">Tidak ada pengeluaran yang tercatat kemarin.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 sm:col-span-2 sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
            <span>Pengingat 7 hari</span>
            <span>{data!.upcoming.length} agenda</span>
          </div>
          {data!.upcoming.length ? (
            <ul className="mt-3 space-y-2 text-sm text-text">
              {data!.upcoming.map((item) => (
                <li key={`${item.name}-${item.days}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted">{formatDaysLabel(item.days)}</p>
                  </div>
                  <div className="text-sm font-semibold text-brand">{formatCurrency(item.amount)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Tidak ada tagihan yang jatuh tempo dalam 7 hari.
            </p>
          )}
        </div>
      </div>
    </>
  ) : (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-border-subtle border-t-transparent" aria-hidden="true" />
      <p className="text-sm text-muted" role="status" aria-live="polite">
        Menyiapkan ringkasan harian…
      </p>
    </div>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-digest-modal-title"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 px-4 py-8"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border-subtle bg-surface p-6 text-text shadow-2xl backdrop-blur-md md:p-8"
        aria-busy={loading}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Tutup ringkasan harian"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-muted transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          ×
        </button>
        <div className="pr-1">{content}</div>
      </div>
    </div>,
    document.body,
  );
}
