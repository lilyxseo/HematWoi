import { X } from 'lucide-react';
import type { WishlistStatus } from '../../lib/wishlistApi';

interface WishlistBatchToolbarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onStatusChange: (status: WishlistStatus) => void;
  onPriorityChange: (priority: number) => void;
  isProcessing?: boolean;
}

const statusOptions: Array<{ value: WishlistStatus; label: string }> = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Arsip' },
];

const selectClassName =
  'h-10 rounded-2xl border-none bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]';

export default function WishlistBatchToolbar({
  selectedCount,
  onClear,
  onDelete,
  onStatusChange,
  onPriorityChange,
  isProcessing = false,
}: WishlistBatchToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 w-[min(96%,40rem)] -translate-x-1/2 rounded-3xl border border-slate-800/80 bg-slate-950/95 p-4 text-slate-100 shadow-[0_40px_70px_-35px_rgb(15_23_42/0.75)] backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-slate-200">
          {selectedCount} item dipilih
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="batch-status">
            Ubah status
          </label>
          <select
            id="batch-status"
            className={selectClassName}
            onChange={(event) => {
              const value = event.target.value as WishlistStatus;
              onStatusChange(value);
              event.target.value = '';
            }}
            defaultValue=""
            disabled={isProcessing}
          >
            <option value="" disabled>
              Set status…
            </option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="batch-priority">
            Set prioritas
          </label>
          <select
            id="batch-priority"
            className={selectClassName}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                onPriorityChange(value);
              }
              event.target.value = '';
            }}
            defaultValue=""
            disabled={isProcessing}
          >
            <option value="" disabled>
              Set prioritas…
            </option>
            {[1, 2, 3, 4, 5].map((priority) => (
              <option key={priority} value={priority}>
                Prioritas {priority}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={isProcessing}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-rose-500/20 px-4 text-sm font-medium text-rose-200 transition hover:bg-rose-500/30 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-700/80 px-4 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Batal pilih
          </button>
        </div>
      </div>
    </div>
  );
}
