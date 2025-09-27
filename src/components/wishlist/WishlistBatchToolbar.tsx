import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { WishlistStatus } from '../../lib/wishlistApi';

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
      <div className="flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-3xl border border-border-subtle bg-surface-elevated/95 px-5 py-3 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="flex flex-1 flex-wrap items-center gap-3 text-sm text-muted">
          <span className="font-semibold text-text">{selectedCount} dipilih</span>
          <div className="flex items-center gap-2 text-xs text-muted">
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
                className="h-9 rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
                className="h-9 rounded-2xl border border-border-subtle bg-surface px-3 text-sm text-text shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border-subtle bg-surface px-4 text-sm font-medium text-text transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            disabled={disabled}
          >
            Batalkan
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-danger px-4 text-sm font-semibold text-inverse shadow transition hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
