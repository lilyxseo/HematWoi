/**
 * WishlistBatchToolbar surfaces bulk actions when items are selected, supporting status/priority changes.
 * It keeps controls sticky near the bottom on mobile for better reachability.
 */
import { useState } from 'react';
import type { WishlistStatus } from '../../lib/wishlistApi';
import { IconTrash, IconX } from './icons';

export interface WishlistBatchToolbarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onStatusChange: (status: WishlistStatus) => void;
  onPriorityChange: (priority: number) => void;
  disabled?: boolean;
}

export default function WishlistBatchToolbar({
  selectedCount,
  onClear,
  onDelete,
  onStatusChange,
  onPriorityChange,
  disabled = false,
}: WishlistBatchToolbarProps) {
  const [statusDraft, setStatusDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState('');

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-4xl flex-wrap items-center gap-3 rounded-3xl border border-slate-800/80 bg-slate-950/95 px-5 py-3 text-sm text-slate-100 shadow-2xl backdrop-blur">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            {selectedCount} dipilih
          </span>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span>Status</span>
            <select
              value={statusDraft}
              onChange={(event) => {
                const value = event.target.value;
                setStatusDraft(value);
                if (value) {
                  onStatusChange(value as WishlistStatus);
                  setTimeout(() => setStatusDraft(''), 200);
                }
              }}
              className="h-10 rounded-2xl border-none bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
              disabled={disabled}
            >
              <option value="">Ubah status…</option>
              <option value="planned">Direncanakan</option>
              <option value="deferred">Ditunda</option>
              <option value="purchased">Dibeli</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span>Prioritas</span>
            <select
              value={priorityDraft}
              onChange={(event) => {
                const value = event.target.value;
                setPriorityDraft(value);
                if (value) {
                  onPriorityChange(Number(value));
                  setTimeout(() => setPriorityDraft(''), 200);
                }
              }}
              className="h-10 rounded-2xl border-none bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
              disabled={disabled}
            >
              <option value="">Set prioritas…</option>
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-800/70 px-4 text-sm font-medium text-slate-200 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            disabled={disabled}
          >
            <IconX className="h-4 w-4" aria-hidden="true" /> Batalkan
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400"
            disabled={disabled}
          >
            <IconTrash className="h-4 w-4" aria-hidden="true" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
