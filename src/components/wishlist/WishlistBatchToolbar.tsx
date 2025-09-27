/**
 * WishlistBatchToolbar appears when the user selects one or more wishlist cards.
 * It exposes quick actions (delete, set status, set priority) while remaining sticky
 * near the bottom of the viewport for easy thumb reach on mobile devices.
 */
import { useState } from 'react';
import { IconTrash, IconCheckCircle, IconX } from '../icons/WishlistIcons';
import type { WishlistStatus } from '../../lib/wishlistApi';

interface WishlistBatchToolbarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onStatusChange: (status: WishlistStatus) => void;
  onPriorityChange: (priority: number) => void;
  disabled?: boolean;
}

const STATUS_OPTIONS: { value: WishlistStatus; label: string }[] = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

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
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-3xl border border-slate-800/80 bg-slate-950/90 px-5 py-4 shadow-2xl backdrop-blur">
        <div className="flex flex-1 flex-col gap-2 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-slate-100">
            <IconCheckCircle className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            <span className="font-semibold">{selectedCount} dipilih</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
              Status
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
                className="h-11 rounded-2xl bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
                disabled={disabled}
              >
                <option value="">Pilih status</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
              Prioritas
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
                className="h-11 rounded-2xl bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
                disabled={disabled}
              >
                <option value="">Pilih prioritas</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900/80 px-4 text-sm font-medium text-slate-200 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            disabled={disabled}
          >
            <IconX className="h-4 w-4" aria-hidden="true" /> Batal
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-60"
            disabled={disabled}
          >
            <IconTrash className="h-4 w-4" aria-hidden="true" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
