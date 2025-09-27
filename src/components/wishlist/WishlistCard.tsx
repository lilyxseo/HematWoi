import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Flag,
  ImageOff,
  MoreHorizontal,
  Pencil,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import type { WishlistItem } from '../../lib/wishlistApi';
import { formatCurrency } from '../../lib/format';

type WishlistCardProps = {
  item: WishlistItem;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: (item: WishlistItem) => void;
  onDelete: (item: WishlistItem) => void;
  onMarkPurchased: (item: WishlistItem) => void;
  onMakeGoal: (item: WishlistItem) => void;
  onCopyToTransaction: (item: WishlistItem) => void;
  categoryName?: string;
};

const statusStyles: Record<string, string> = {
  planned: 'bg-blue-500/10 text-blue-200 border border-blue-400/30',
  deferred: 'bg-yellow-500/10 text-yellow-200 border border-yellow-400/30',
  purchased: 'bg-emerald-500/10 text-emerald-200 border border-emerald-400/30',
  archived: 'bg-slate-500/10 text-slate-300 border border-slate-400/20',
};

const priorityColors = ['bg-emerald-500/20 text-emerald-200', 'bg-sky-500/20 text-sky-200', 'bg-amber-500/20 text-amber-200', 'bg-orange-500/20 text-orange-200', 'bg-rose-500/20 text-rose-200'];

export default function WishlistCard({
  item,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onMarkPurchased,
  onMakeGoal,
  onCopyToTransaction,
  categoryName,
}: WishlistCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const priceLabel = item.estimated_price !== null ? formatCurrency(item.estimated_price) : '—';
  const priorityLabel = typeof item.priority === 'number' && item.priority >= 1 && item.priority <= 5 ? item.priority : null;
  const priorityClass = priorityLabel ? priorityColors[priorityLabel - 1] : 'bg-slate-700/50 text-slate-200';

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800 transition hover:ring-[var(--accent)]">
      {item.image_url ? (
        <div className="relative aspect-video w-full overflow-hidden">
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-slate-800 text-slate-500">
          <ImageOff className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border border-slate-700 bg-slate-900 text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            aria-label={`Pilih wishlist ${item.title}`}
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
              {priorityLabel ? (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${priorityClass}`}>
                  P{priorityLabel}
                </span>
              ) : null}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[item.status] ?? statusStyles.planned}`}>
                {item.status === 'planned'
                  ? 'Direncanakan'
                  : item.status === 'deferred'
                  ? 'Ditunda'
                  : item.status === 'purchased'
                  ? 'Dibeli'
                  : 'Arsip'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <div className="font-semibold text-slate-100">{priceLabel}</div>
              {item.category_id ? (
                <div className="rounded-full bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300">
                  {categoryName ?? 'Kategori pribadi'}
                </div>
              ) : null}
              {item.store_url ? (
                <a
                  href={item.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-slate-800/70 px-2 py-0.5 text-xs text-[var(--accent)] hover:text-[var(--accent)]/80"
                >
                  Toko <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Aksi cepat wishlist"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-xl backdrop-blur"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(item);
                  }}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onMakeGoal(item);
                  }}
                >
                  <Flag className="h-4 w-4" /> Jadikan Goal
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onCopyToTransaction(item);
                  }}
                >
                  <Copy className="h-4 w-4" /> Salin ke Transaksi
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onMarkPurchased(item);
                  }}
                  disabled={item.status === 'purchased'}
                >
                  <ShoppingCart className="h-4 w-4" /> Tandai Dibeli
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/20"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(item);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Hapus
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {item.note ? <p className="text-sm text-slate-300 line-clamp-3">{item.note}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Ditambahkan {new Date(item.created_at).toLocaleDateString('id-ID')}</span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Pembaruan {new Date(item.updated_at).toLocaleDateString('id-ID')}
          </span>
        </div>
      </div>
    </article>
  );
}
