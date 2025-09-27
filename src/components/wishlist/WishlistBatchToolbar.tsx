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

const SELECT_CLASS =
  'h-11 rounded-2xl border border-slate-700/70 bg-slate-900 px-3 text-sm text-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

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
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-5 md:top-24 md:bottom-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-3xl border border-slate-800/80 bg-slate-950/90 p-4 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-sm font-semibold text-[var(--accent)]">
              {selectedCount} dipilih
            </span>
            <p className="text-xs text-slate-400">Kelola sekaligus status atau prioritas wishlist Anda.</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            disabled={disabled}
          >
            Bersihkan
          </button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <span>Status</span>
              <select
                value={statusValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setStatusValue(value);
                  if (value) {
                    onStatusChange(value as WishlistStatus);
                    setTimeout(() => setStatusValue(''), 200);
                  }
                }}
                className={SELECT_CLASS}
                disabled={disabled}
              >
                <option value="">Pilih status…</option>
                <option value="planned">Direncanakan</option>
                <option value="deferred">Ditunda</option>
                <option value="purchased">Dibeli</option>
                <option value="archived">Diarsipkan</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <span>Prioritas</span>
              <select
                value={priorityValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setPriorityValue(value);
                  if (value) {
                    onPriorityChange(Number(value));
                    setTimeout(() => setPriorityValue(''), 200);
                  }
                }}
                className={SELECT_CLASS}
                disabled={disabled}
              >
                <option value="">Pilih prioritas…</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
            >
              <TrashIcon /> Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m10 11 1 8m4-8-1 8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
    </svg>
  );
}
