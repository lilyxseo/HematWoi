/**
 * WishlistBatchToolbar menyediakan kontrol aksi massal saat beberapa wishlist dipilih.
 * Toolbar memanggil callback dari parent untuk hapus, ubah status, dan prioritas.
 */
import { useState } from 'react';
import type { WishlistStatus } from '../../lib/wishlistApi';
import { IconTrash } from './WishlistIcons';

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
      <div className="flex w-full max-w-4xl flex-wrap items-center gap-3 rounded-3xl border border-slate-800/90 bg-slate-950/95 px-5 py-4 shadow-2xl backdrop-blur">
        <div className="flex flex-1 flex-wrap items-center gap-3 text-sm text-slate-200">
          <span className="text-sm font-semibold text-slate-100">{selectedCount} dipilih</span>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <label className="flex items-center gap-2">
              <span>Status</span>
              <select
                value={statusValue}
                onChange={(event) => {
                  const next = event.target.value;
                  setStatusValue(next);
                  if (next) {
                    onStatusChange(next as WishlistStatus);
                    setTimeout(() => setStatusValue(''), 200);
                  }
                }}
                className="h-10 rounded-2xl bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
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
                  const next = event.target.value;
                  setPriorityValue(next);
                  if (next) {
                    onPriorityChange(Number(next));
                    setTimeout(() => setPriorityValue(''), 200);
                  }
                }}
                className="h-10 rounded-2xl bg-slate-900/80 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus:outline-none focus:ring-[var(--accent)]"
                disabled={disabled}
              >
                <option value="">Atur prioritas…</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 items-center justify-center rounded-2xl px-4 font-medium text-slate-200 ring-2 ring-slate-800 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-[var(--accent)]"
            disabled={disabled}
          >
            Batalkan
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-500/90 px-4 font-semibold text-white shadow-lg transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            disabled={disabled}
          >
            <IconTrash className="h-4 w-4" aria-hidden="true" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
