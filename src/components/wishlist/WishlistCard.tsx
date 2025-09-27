import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Flag,
  MoreHorizontal,
  Pencil,
  ShoppingBag,
  Trash,
} from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import type { WishlistItem } from '../../lib/wishlistApi';

interface WishlistCardProps {
  item: WishlistItem;
  categoryName?: string | null;
  selected?: boolean;
  onSelectChange?: (id: string, selected: boolean) => void;
  onEdit?: (item: WishlistItem) => void;
  onDelete?: (item: WishlistItem) => void;
  onMarkPurchased?: (item: WishlistItem) => void;
  onMakeGoal?: (item: WishlistItem) => void;
  onCopyToTransaction?: (item: WishlistItem) => void;
}

const STATUS_STYLES: Record<string, string> = {
  planned: 'bg-slate-800/70 text-slate-200 border border-slate-700/80',
  deferred: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
  purchased: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30',
  archived: 'bg-slate-700/60 text-slate-300 border border-slate-700/80',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Direncanakan',
  deferred: 'Ditunda',
  purchased: 'Dibeli',
  archived: 'Diarsipkan',
};

const PRIORITY_BADGES: Record<number, string> = {
  1: 'bg-[color:var(--accent)]/15 text-[color:var(--accent)] border border-[color:var(--accent)]/30',
  2: 'bg-sky-500/10 text-sky-200 border border-sky-500/20',
  3: 'bg-violet-500/10 text-violet-200 border border-violet-500/20',
  4: 'bg-amber-500/10 text-amber-200 border border-amber-500/20',
  5: 'bg-rose-500/10 text-rose-200 border border-rose-500/20',
};

export default function WishlistCard({
  item,
  categoryName,
  selected = false,
  onSelectChange,
  onEdit,
  onDelete,
  onMarkPurchased,
  onMakeGoal,
  onCopyToTransaction,
}: WishlistCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleMenuAction = (callback?: (item: WishlistItem) => void) => () => {
    callback?.(item);
    setMenuOpen(false);
  };

  const priority = item.priority ? Math.round(Number(item.priority)) : null;
  const priceLabel =
    typeof item.estimated_price === 'number'
      ? formatCurrency(item.estimated_price, 'IDR')
      : 'Belum ditentukan';

  const statusStyle = STATUS_STYLES[item.status] ?? STATUS_STYLES.planned;
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/80 ring-1 ring-slate-800 transition hover:ring-[color:var(--accent)]/60">
      {item.image_url ? (
        <div className="relative aspect-video w-full overflow-hidden">
          <img
            src={item.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <label className="mt-1 flex items-start">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectChange?.(item.id, event.target.checked)}
              aria-label={`Pilih ${item.title}`}
              className="h-4 w-4 rounded border border-slate-700 bg-slate-900 text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            />
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-white line-clamp-2">{item.title}</h3>
                {categoryName ? (
                  <p className="text-xs text-muted">{categoryName}</p>
                ) : null}
              </div>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Aksi cepat wishlist"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-muted transition hover:border-slate-700 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 p-1 text-sm text-text shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={handleMenuAction(onMakeGoal)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                    >
                      <Flag className="h-4 w-4" /> Jadikan Goal
                    </button>
                    <button
                      type="button"
                      onClick={handleMenuAction(onMarkPurchased)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={item.status === 'purchased'}
                    >
                      <ShoppingBag className="h-4 w-4" /> Tandai Dibeli
                    </button>
                    <button
                      type="button"
                      onClick={handleMenuAction(onCopyToTransaction)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                    >
                      <Copy className="h-4 w-4" /> Salin ke Transaksi
                    </button>
                    <button
                      type="button"
                      onClick={handleMenuAction(onEdit)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleMenuAction(onDelete)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-rose-300 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash className="h-4 w-4" /> Hapus
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {priority ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_BADGES[priority] ?? PRIORITY_BADGES[1]}`}>
                  Prioritas {priority}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-slate-700 px-2.5 py-1 text-xs text-muted">
                  Prioritas belum ditetapkan
                </span>
              )}
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle}`}>
                {statusLabel}
              </span>
              <span className="inline-flex items-center rounded-full border border-slate-700 px-2.5 py-1 text-xs text-muted">
                {priceLabel}
              </span>
            </div>
          </div>
        </div>

        {item.note ? (
          <p className="line-clamp-3 text-sm text-muted">{item.note}</p>
        ) : null}

        {item.store_url ? (
          <a
            href={item.store_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center text-xs font-medium text-[color:var(--accent)] hover:underline"
          >
            Lihat toko
          </a>
        ) : null}
      </div>
    </article>
  );
}
