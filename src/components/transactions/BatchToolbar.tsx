import { Tag, Trash2, X } from "lucide-react";

interface BatchToolbarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onChangeCategory: () => void;
  deleteDisabled?: boolean;
  changeDisabled?: boolean;
}

export default function BatchToolbar({
  count,
  onClear,
  onDelete,
  onChangeCategory,
  deleteDisabled = false,
  changeDisabled = false,
}: BatchToolbarProps) {
  if (count <= 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div
        className="pointer-events-auto flex w-full max-w-xl items-center justify-between gap-4 rounded-3xl bg-slate-900/90 px-5 py-3 text-sm text-slate-200 shadow-2xl ring-1 ring-slate-800"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/20 text-sm font-semibold text-[var(--accent)]">
            {count}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-100">{count} transaksi dipilih</p>
            <button
              type="button"
              onClick={onClear}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
              aria-label="Batalkan pilihan"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Bersihkan
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={deleteDisabled}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-500/20 px-4 text-sm font-semibold text-rose-100 ring-1 ring-rose-500/40 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Hapus transaksi terpilih"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
          </button>
          <button
            type="button"
            onClick={onChangeCategory}
            disabled={changeDisabled}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--accent)]/20 px-4 text-sm font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]/50 transition hover:bg-[var(--accent)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Ubah kategori transaksi terpilih"
          >
            <Tag className="h-4 w-4" aria-hidden="true" /> Ubah Kategori
          </button>
        </div>
      </div>
    </div>
  );
}
