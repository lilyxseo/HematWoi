import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { WishlistStatus } from '../../lib/wishlistApi';
import { WISHLIST_PRIORITY_LABELS } from '../../lib/wishlistPriority';

interface WishlistBatchToolbarProps {
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
  const [statusValue, setStatusValue] = useState('');
  const [priorityValue, setPriorityValue] = useState('');

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-3xl border border-slate-800/80 bg-slate-950/90 px-5 py-3 shadow-2xl backdrop-blur">
        <div className="flex flex-1 flex-wrap items-center gap-3 text-sm text-slate-200">
          <span className="font-semibold text-slate-100">{selectedCount} dipilih</span>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <label className="flex items-center gap-2">
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
                className="h-9 rounded-2xl border-none bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
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
                className="h-9 rounded-2xl border-none bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
                disabled={disabled}
              >
                <option value="">Set prioritas…</option>
                {Object.entries(WISHLIST_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    Prioritas {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-medium text-slate-300 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            disabled={disabled}
          >
            Batalkan
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
