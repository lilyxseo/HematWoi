import clsx from "clsx";
import { ArrowRightLeft, Tag, Trash2 } from "lucide-react";

interface BatchToolbarProps {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onChangeCategory: () => void;
  onChangeAccount?: () => void;
  deleting?: boolean;
  updating?: boolean;
  className?: string;
}

export default function BatchToolbar({
  count,
  onClear,
  onDelete,
  onChangeCategory,
  onChangeAccount,
  deleting = false,
  updating = false,
  className,
}: BatchToolbarProps) {
  if (count <= 0) return null;

  return (
    <div
      className={clsx(
        "pointer-events-auto fixed inset-x-0 bottom-6 z-40 flex justify-center px-4",
        className,
      )}
      role="region"
      aria-live="polite"
      aria-label="Aksi batch transaksi"
    >
      <div className="flex w-full max-w-xl items-center justify-between gap-3 rounded-3xl bg-slate-900/90 p-3 text-slate-200 shadow-2xl ring-1 ring-slate-800 backdrop-blur">
        <div className="flex flex-1 items-center gap-2 text-sm font-medium">
          <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full bg-[var(--accent)]/20 px-2 text-[var(--accent)]">
            {count}
          </span>
          <span>{count === 1 ? "1 transaksi dipilih" : `${count} transaksi dipilih`}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 items-center rounded-2xl px-4 text-sm font-semibold text-slate-400 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onChangeCategory}
            disabled={updating || deleting}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-800 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Ubah kategori transaksi dipilih"
          >
            <Tag className="h-4 w-4" aria-hidden="true" />
            Ubah Kategori
          </button>
          {onChangeAccount && (
            <button
              type="button"
              onClick={onChangeAccount}
              disabled={updating || deleting}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-800 px-4 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Ubah akun transaksi dipilih"
            >
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
              Ubah Akun
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-70"
            aria-label="Hapus transaksi dipilih"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}
