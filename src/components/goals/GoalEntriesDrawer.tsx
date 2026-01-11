import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import type { GoalEntryRecord, GoalRecord } from '../../lib/api-goals';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function parseDecimal(value: string): number {
  if (!value) return Number.NaN;
  const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatAmountInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

interface GoalEntriesDrawerProps {
  open: boolean;
  goal: GoalRecord | null;
  entries: GoalEntryRecord[];
  loading?: boolean;
  submitting?: boolean;
  deletingId?: string | null;
  onClose: () => void;
  onSubmit: (payload: { amount: number; date: string; note?: string | null }) => Promise<void> | void;
  onDeleteEntry: (entry: GoalEntryRecord) => void;
}

export default function GoalEntriesDrawer({
  open,
  goal,
  entries,
  loading,
  submitting,
  deletingId,
  onClose,
  onSubmit,
  onDeleteEntry,
}: GoalEntriesDrawerProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; date?: string }>({});
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setDate(todayIsoDate());
    setNote('');
    setErrors({});
  }, [open, goal?.id]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const node = panelRef.current;
    if (!node) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
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
    node.addEventListener('keydown', handleKeyDown);
    return () => node.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const totalEntries = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.amount ?? 0), 0), [entries]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = parseDecimal(amount);
    const trimmedDate = date?.trim() ?? '';
    const nextErrors: { amount?: string; date?: string } = {};

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      nextErrors.amount = 'Masukkan nominal lebih dari 0.';
    }

    const parsedDate = trimmedDate ? new Date(trimmedDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      nextErrors.date = 'Pilih tanggal yang valid.';
    }

    if (nextErrors.amount || nextErrors.date) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        amount: Number(parsedAmount.toFixed(2)),
        date: trimmedDate || todayIsoDate(),
        note: note.trim() ? note.trim() : null,
      });
      setAmount('');
      setNote('');
    } catch (submitError) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.error('[HW][GoalEntriesDrawer] submit', submitError);
      }
    }
  };

  if (!open || !goal) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur supports-[backdrop-filter]:bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[70] flex min-h-full items-center justify-center px-4 py-8">
        <div
          ref={panelRef}
          className="flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-3xl border border-border/60 bg-card/95 shadow-xl backdrop-blur"
          role="dialog"
          aria-modal="true"
        >
          <header className="border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Setoran Goal</p>
                <h2 className="mt-1 truncate text-lg font-semibold text-text">{goal.title}</h2>
                <p className="text-xs text-muted">
                  Total setoran tercatat: {currencyFormatter.format(totalEntries)}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-1 text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                aria-label="Tutup panel goal"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-3 border-b border-border/60 px-6 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-text">
                  Nominal setoran
                  <input
                    name="amount"
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(event) => setAmount(formatAmountInput(event.target.value))}
                    className={`h-[44px] rounded-xl border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
                      errors.amount ? 'border-danger/70' : 'border-border bg-surface-1'
                    }`}
                    placeholder="1.000.000"
                    required
                  />
                  {errors.amount ? <span className="text-xs text-danger">{errors.amount}</span> : null}
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-text">
                  Tanggal setoran
                  <input
                    name="date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={`h-[44px] rounded-xl border px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] ${
                      errors.date ? 'border-danger/70' : 'border-border bg-surface-1'
                    }`}
                    required
                  />
                  {errors.date ? <span className="text-xs text-danger">{errors.date}</span> : null}
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-text">
                Catatan (opsional)
                <textarea
                  name="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                  placeholder="Catatan singkat setoran"
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={Boolean(submitting)}
                  className="inline-flex h-[40px] items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Menambahkan…' : 'Tambah setoran'}
                </button>
              </div>
            </form>

            <div className="px-6 py-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Riwayat setoran</h3>
              {loading ? (
                <p className="text-sm text-muted">Memuat riwayat…</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-muted">Belum ada setoran tercatat untuk goal ini.</p>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <article
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-surface-1/80 p-3 shadow-sm"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-text">
                          {currencyFormatter.format(Number(entry.amount ?? 0))}
                        </p>
                        <p className="text-xs text-muted">
                          {dateFormatter.format(new Date(entry.date ?? entry.created_at))}
                        </p>
                        {entry.note ? <p className="text-sm text-text/80">{entry.note}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry)}
                        disabled={deletingId === entry.id}
                        className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-1 text-muted transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Hapus setoran"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-border/60 bg-card/95 px-6 py-4">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>Total setoran</span>
              <span className="font-semibold text-text">{currencyFormatter.format(totalEntries)}</span>
            </div>
          </footer>
        </div>
      </div>
    </>,
    document.body,
  );
}
