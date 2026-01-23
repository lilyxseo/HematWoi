import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DailyDigestModalData } from '../hooks/useShowDigestOnLogin';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { formatMoney } from '../lib/format';

interface DailyDigestModalProps {
  open: boolean;
  data: DailyDigestModalData | null;
  loading: boolean;
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

function formatDaysLabel(days: number): string {
  if (days <= 0) return 'Hari ini';
  if (days === 1) return 'Besok';
  return `Dalam ${days} hari`;
}

export default function DailyDigestModal({ open, data, loading, onClose }: DailyDigestModalProps) {
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

  const hasData = Boolean(data) && !loading;

  const content = hasData ? (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{data!.todayLabel}</p>
          <h2 id="daily-digest-modal-title" className="text-2xl font-semibold text-text">Daily Digest</h2>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-alt/70 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Saldo total</p>
          <p className="text-lg font-semibold text-text hw-money">{formatMoney(data!.balance, 'IDR')}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-3xl border border-border-subtle bg-surface-alt/40 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Aktivitas hari ini</p>
              <p className="mt-2 text-2xl font-semibold text-text">
                <span className="text-danger hw-money">-{formatMoney(data!.todayExpense, 'IDR')}</span>
                <span className="mx-2 text-muted">/</span>
                <span className="text-success hw-money">+{formatMoney(data!.todayIncome, 'IDR')}</span>
              </p>
              <p className="mt-1 text-xs text-muted">
                {data!.todayCount} transaksi · Net <span className="hw-money">{formatMoney(data!.todayNet, 'IDR')}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-text">
                Net {data!.todayNet >= 0 ? 'positif' : 'negatif'}
              </span>
              <span className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-text">
                {data!.todayCount} transaksi
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Top pengeluaran hari ini</p>
            {data!.topTodayExpenses.length ? (
              <ul className="mt-3 space-y-2 text-sm text-text">
                {data!.topTodayExpenses.map((item) => (
                  <li key={item.name} className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-semibold text-danger hw-money">-{formatMoney(item.amount, 'IDR')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Belum ada pengeluaran yang tercatat hari ini.</p>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-border-subtle bg-surface-alt/40 p-4 sm:p-5">
          <div className="rounded-2xl border border-border-subtle bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ringkasan kemarin</p>
            <p className="mt-2 text-xl font-semibold text-danger">
              <span className="hw-money">-{formatMoney(data!.yesterdayExpense, 'IDR')}</span>
            </p>
            {data!.yesterdayCount > 0 ? (
              <p className="mt-1 text-xs text-muted">{data!.yesterdayCount} transaksi tercatat kemarin.</p>
            ) : (
              <p className="mt-1 text-xs text-muted">Tidak ada pengeluaran yang tercatat kemarin.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Top pengeluaran kemarin</p>
            {data!.topYesterdayExpenses.length ? (
              <ul className="mt-3 space-y-2 text-sm text-text">
                {data!.topYesterdayExpenses.map((item) => (
                  <li key={item.name} className="flex items-center justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span className="font-semibold text-danger hw-money">-{formatMoney(item.amount, 'IDR')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Tidak ada pengeluaran besar kemarin.</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border-subtle bg-surface-alt/40 p-4 sm:col-span-2 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pengingat 7 hari</p>
              <p className="mt-1 text-sm text-muted">Agenda penting yang akan datang.</p>
            </div>
            <span className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-text">
              {data!.upcoming.length} agenda
            </span>
          </div>
          {data!.upcoming.length ? (
            <div className="mt-4 space-y-3">
              {data!.upcoming.map((item) => (
                <div
                  key={`${item.name}-${item.days}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-text">{item.name}</p>
                    <p className="text-xs text-muted">{formatDaysLabel(item.days)}</p>
                  </div>
                  <span className="text-sm font-semibold text-brand">
                    <span className="hw-money">{formatMoney(item.amount, 'IDR')}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Tidak ada tagihan yang jatuh tempo dalam 7 hari.</p>
          )}
        </div>
      </div>
    </>
  ) : (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-border-subtle border-t-transparent" aria-hidden="true" />
      <p className="text-sm text-muted">Menyiapkan ringkasan harian…</p>
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
