import { useState } from 'react';
import type { WishlistStatus } from '../../lib/wishlistApi';

interface WishlistBatchToolbarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onStatusChange: (status: WishlistStatus) => void;
  onPriorityChange: (priority: number) => void;
  disabled?: boolean;
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 6l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v5M14 11v5" />
    </svg>
  );
}

export default function WishlistBatchToolbar({
  selectedCount,
  onClear,
  onDelete,
  onStatusChange,
  onPriorityChange,
  disabled = false,
}: WishlistBatchToolbarProps) {
  const [statusValue, setStatusValue] = useState('');
  const [priorityValue, setPriorityValue] = useState('');

  return (
    <div className="fixed bottom-5 left-0 right-0 z-40 px-4 md:static md:px-0">
      <div className="mx-auto max-w-5xl md:sticky md:top-24">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-950/85 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
              <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200">
                {selectedCount} dipilih
              </span>
              <span className="text-xs text-slate-400">Kelola banyak wishlist sekaligus.</span>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              disabled={disabled}
            >
              Batalkan pilihan
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</span>
                <select
                  value={statusValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStatusValue(value);
                    if (value) {
                      onStatusChange(value as WishlistStatus);
                      setTimeout(() => setStatusValue(''), 150);
                    }
                  }}
                  className="h-10 rounded-2xl border-none bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
                  disabled={disabled}
                >
                  <option value="">Ubah status…</option>
                  <option value="planned">Direncanakan</option>
                  <option value="deferred">Ditunda</option>
                  <option value="purchased">Dibeli</option>
                  <option value="archived">Diarsipkan</option>
                </select>
              </label>

              <label className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prioritas</span>
                <select
                  value={priorityValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPriorityValue(value);
                    if (value) {
                      onPriorityChange(Number(value));
                      setTimeout(() => setPriorityValue(''), 150);
                    }
                  }}
                  className="h-10 rounded-2xl border-none bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
                  disabled={disabled}
                >
                  <option value="">Set prioritas…</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
            >
              <TrashIcon className="h-4 w-4" /> Hapus Terpilih
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
