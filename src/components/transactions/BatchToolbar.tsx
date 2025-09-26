import clsx from "clsx";
import { Loader2, Trash2, Wand2 } from "lucide-react";
import { ReactNode } from "react";

interface BatchToolbarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onChangeCategory: () => void;
  deleting?: boolean;
  updating?: boolean;
  className?: string;
  secondaryAction?: ReactNode;
}

export default function BatchToolbar({
  count,
  onClear,
  onDelete,
  onChangeCategory,
  deleting = false,
  updating = false,
  className,
  secondaryAction,
}: BatchToolbarProps) {
  if (count <= 0) return null;

  return (
    <div
      className={clsx(
        "pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4",
        className,
      )}
      aria-live="polite"
    >
      <div className="pointer-events-auto flex w-full max-w-xl flex-col gap-3 rounded-3xl bg-slate-900/95 p-4 text-slate-200 shadow-2xl ring-1 ring-slate-800 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/10 px-3 py-1 text-sm font-semibold text-[var(--accent)]">
            {count} dipilih
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Batal
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {secondaryAction}
          <button
            type="button"
            onClick={onChangeCategory}
            disabled={updating}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
            Ubah Kategori
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500/20 px-4 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
