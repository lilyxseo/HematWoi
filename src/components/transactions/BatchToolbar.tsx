import { Loader2, Sparkles, Tags, Trash2, X } from "lucide-react";
import clsx from "clsx";

interface BatchToolbarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete: () => void;
  onChangeCategory: () => void;
  deleting?: boolean;
  updating?: boolean;
}

export default function BatchToolbar({
  selectedCount,
  onClear,
  onDelete,
  onChangeCategory,
  deleting = false,
  updating = false,
}: BatchToolbarProps) {
  const busy = deleting || updating;

  return (
    <div
      className={clsx(
        "pointer-events-auto fixed inset-x-4 bottom-6 z-30 flex justify-center md:inset-x-auto",
        "md:left-1/2 md:w-auto md:-translate-x-1/2",
      )}
      role="region"
      aria-label="Aksi batch transaksi"
    >
      <div
        className="flex w-full max-w-xl items-center gap-3 rounded-2xl bg-slate-900/95 p-3 text-slate-200 shadow-2xl ring-1 ring-slate-800 backdrop-blur"
      >
        <div className="flex flex-1 items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
          <span className="font-medium">
            {selectedCount} transaksi dipilih
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/70 text-slate-300 ring-1 ring-slate-700 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Batal pilih"
            disabled={busy}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onChangeCategory}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-800/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
          >
            <Tags className="h-4 w-4" aria-hidden="true" />
            Ubah Kategori
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-rose-500/20 px-4 text-sm font-semibold text-rose-200 ring-1 ring-rose-500/40 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={deleting}
            aria-label="Hapus transaksi terpilih"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            {!deleting && "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}
