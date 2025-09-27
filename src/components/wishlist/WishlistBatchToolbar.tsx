import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { WishlistStatus } from '../../lib/wishlistApi';

interface WishlistBatchToolbarProps {
  open: boolean;
  selectedCount: number;
  processing?: boolean;
  onClear: () => void;
  onDelete: () => void;
  onChangeStatus: (status: WishlistStatus) => void;
  onChangePriority: (priority: number) => void;
}

const STATUS_OPTIONS: { value: WishlistStatus; label: string }[] = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'deferred', label: 'Ditunda' },
  { value: 'purchased', label: 'Dibeli' },
  { value: 'archived', label: 'Diarsipkan' },
];

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Prioritas 1' },
  { value: 2, label: 'Prioritas 2' },
  { value: 3, label: 'Prioritas 3' },
  { value: 4, label: 'Prioritas 4' },
  { value: 5, label: 'Prioritas 5' },
];

export default function WishlistBatchToolbar({
  open,
  selectedCount,
  processing = false,
  onClear,
  onDelete,
  onChangeStatus,
  onChangePriority,
}: WishlistBatchToolbarProps) {
  const [statusValue, setStatusValue] = useState('');
  const [priorityValue, setPriorityValue] = useState('');

  useEffect(() => {
    if (!open) {
      setStatusValue('');
      setPriorityValue('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-full max-w-3xl -translate-x-1/2 rounded-3xl border border-slate-800 bg-slate-900/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{selectedCount} item dipilih</p>
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Batalkan pilihan
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">Status</label>
            <select
              value={statusValue}
              onChange={(event) => {
                const value = event.target.value;
                setStatusValue(value);
                if (value) {
                  onChangeStatus(value as WishlistStatus);
                  setTimeout(() => setStatusValue(''), 0);
                }
              }}
              disabled={processing}
              className="h-[40px] rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Ubah status…</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted">Prioritas</label>
            <select
              value={priorityValue}
              onChange={(event) => {
                const value = event.target.value;
                setPriorityValue(value);
                if (value) {
                  onChangePriority(Number(value));
                  setTimeout(() => setPriorityValue(''), 0);
                }
              }}
              disabled={processing}
              className="h-[40px] rounded-2xl border border-slate-800 bg-transparent px-3 text-sm text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Set prioritas…</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onDelete}
            disabled={processing}
            className="inline-flex h-[40px] items-center gap-2 rounded-2xl border border-rose-500/50 bg-rose-500/10 px-4 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
