import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  Flag,
  Link as LinkIcon,
  MoreHorizontal,
  Pencil,
  ShoppingCart,
  Trash2,
  Copy,
} from 'lucide-react';
import type { WishlistItem, WishlistStatus } from '../../lib/wishlistApi';
import { formatCurrency } from '../../lib/format';

interface WishlistCardProps {
  item: WishlistItem;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkPurchased: () => void;
  onConvertToGoal: () => void;
  onCopyToTransaction: () => void;
  categoryName?: string | null;
}

const statusLabels: Record<WishlistStatus, string> = {
  planned: 'Direncanakan',
  deferred: 'Ditunda',
  purchased: 'Dibeli',
  archived: 'Arsip',
};

const statusStyles: Record<WishlistStatus, string> = {
  planned: 'bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/40',
  deferred: 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/40',
  purchased: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/40',
  archived: 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/40',
};

function PriorityBadge({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
      <Flag className="h-3 w-3" aria-hidden="true" />P{value}
    </span>
  );
}

export default function WishlistCard({
  item,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onMarkPurchased,
  onConvertToGoal,
  onCopyToTransaction,
  categoryName,
}: WishlistCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const purchased = item.status === 'purchased';
  const priceLabel = item.estimated_price ? formatCurrency(item.estimated_price, 'IDR') : 'Belum ditaksir';

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 shadow-[0_30px_80px_-40px_rgb(15_23_42/0.65)] transition hover:-translate-y-0.5 hover:border-slate-700/80">
      {item.image_url ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <label className="mt-1 inline-flex items-center">
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => onSelect(event.target.checked)}
                className="h-5 w-5 rounded-lg border border-slate-700 bg-slate-900 text-[var(--accent)] focus:ring-[var(--accent)]"
                aria-label={`Pilih ${item.title}`}
              />
            </label>
            <div>
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              {categoryName ? (
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {categoryName}
                </p>
              ) : null}
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-800/80 bg-slate-900/80 text-slate-300 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label="Buka menu aksi"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-10 mt-2 w-52 rounded-2xl border border-slate-800/80 bg-slate-900/95 p-2 text-sm shadow-xl backdrop-blur"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onConvertToGoal();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-200 transition hover:bg-slate-800"
                  role="menuitem"
                >
                  <Flag className="h-4 w-4" aria-hidden="true" /> Jadikan Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMarkPurchased();
                  }}
                  disabled={purchased}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  role="menuitem"
                >
                  <CheckCircle className="h-4 w-4" aria-hidden="true" /> Tandai Dibeli
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onCopyToTransaction();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-200 transition hover:bg-slate-800"
                  role="menuitem"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" /> Salin ke Transaksi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-200 transition hover:bg-slate-800"
                  role="menuitem"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-rose-300 transition hover:bg-rose-500/10"
                  role="menuitem"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge value={item.priority ?? null} />
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[item.status]}`}>
            <ShoppingCart className="h-3 w-3" aria-hidden="true" /> {statusLabels[item.status]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">
            {priceLabel}
          </span>
        </div>
        {item.note ? (
          <p className="text-sm text-slate-300 line-clamp-3">{item.note}</p>
        ) : null}
        {item.store_url ? (
          <a
            href={item.store_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            <LinkIcon className="h-4 w-4" aria-hidden="true" /> Kunjungi toko
          </a>
        ) : null}
      </div>
    </div>
  );
}
