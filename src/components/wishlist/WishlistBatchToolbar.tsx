import { useState, type SVGProps } from 'react';
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
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-5 md:top-24 md:bottom-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/90 px-5 py-4 shadow-2xl backdrop-blur">
        <div className="flex flex-1 flex-wrap items-center gap-3 text-sm text-slate-200">
          <span className="rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            {selectedCount} dipilih
          </span>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
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
                className="h-10 rounded-2xl bg-slate-950 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
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
                className="h-10 rounded-2xl bg-slate-950 px-3 text-sm text-slate-100 ring-2 ring-slate-800 transition focus-visible:outline-none focus-visible:ring-[var(--accent)]"
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
            className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-slate-300 transition hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            disabled={disabled}
          >
            Batalkan
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-500/90 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-70"
            disabled={disabled}
          >
            <TrashIcon className="h-4 w-4" /> Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V4h6v3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7v11a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7" />
    </svg>
  );
}
