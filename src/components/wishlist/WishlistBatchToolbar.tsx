import type { WishlistStatus } from '../../lib/wishlistApi';

interface WishlistBatchToolbarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onUpdateStatus: (status: WishlistStatus) => void;
  onUpdatePriority: (priority: number) => void;
  disabled?: boolean;
}

export default function WishlistBatchToolbar({
  count,
  onClear,
  onDelete,
  onUpdateStatus,
  onUpdatePriority,
  disabled,
}: WishlistBatchToolbarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/95 px-5 py-3 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="text-sm font-medium text-slate-200">
          {count} item terpilih
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select
            className="h-10 rounded-2xl border-0 bg-slate-800/80 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value;
              if (!value) return;
              onUpdateStatus(value as WishlistStatus);
              event.target.value = '';
            }}
            disabled={disabled}
            aria-label="Ubah status wishlist terpilih"
          >
            <option value="" disabled>
              Ubah status
            </option>
            <option value="planned">Direncanakan</option>
            <option value="deferred">Ditunda</option>
            <option value="purchased">Dibeli</option>
            <option value="archived">Arsip</option>
          </select>
          <select
            className="h-10 rounded-2xl border-0 bg-slate-800/80 px-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            defaultValue=""
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isFinite(value)) return;
              onUpdatePriority(value);
              event.target.value = '';
            }}
            disabled={disabled}
            aria-label="Ubah prioritas wishlist terpilih"
          >
            <option value="" disabled>
              Atur prioritas
            </option>
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                Prioritas {level}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="h-10 rounded-2xl border border-rose-500/40 px-4 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hapus
          </button>
          <button
            type="button"
            onClick={onClear}
            className="h-10 rounded-2xl border border-slate-700 px-4 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
