import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  EllipsisVertical,
  ExternalLink,
  Goal,
  NotebookPen,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import type { WishlistItem, WishlistStatus } from '../../lib/wishlistApi';

interface WishlistCardProps {
  item: WishlistItem;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
  onEdit: (item: WishlistItem) => void;
  onDelete: (item: WishlistItem) => void;
  onMarkPurchased: (item: WishlistItem) => void;
  onMakeGoal: (item: WishlistItem) => void;
  onCopyToTransaction: (item: WishlistItem) => void;
  disabled?: boolean;
}

const STATUS_LABEL: Record<WishlistStatus, string> = {
  planned: 'Direncanakan',
  deferred: 'Ditunda',
  purchased: 'Dibeli',
  archived: 'Diarsipkan',
};

const STATUS_STYLE: Record<WishlistStatus, string> = {
  planned: 'bg-slate-800/80 text-slate-200 border border-slate-700',
  deferred: 'bg-amber-500/10 text-amber-300 border border-amber-400/30',
  purchased: 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/30',
  archived: 'bg-slate-800/60 text-slate-400 border border-slate-700/70',
};

const PRIORITY_STYLE: Record<number, string> = {
  1: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30',
  2: 'bg-teal-500/15 text-teal-200 border border-teal-400/30',
  3: 'bg-sky-500/15 text-sky-200 border border-sky-400/30',
  4: 'bg-violet-500/15 text-violet-200 border border-violet-400/30',
  5: 'bg-rose-500/15 text-rose-200 border border-rose-400/30',
};

function formatCurrencyIDR(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function WishlistCard({
  item,
  selected,
  onSelectChange,
  onEdit,
  onDelete,
  onMarkPurchased,
  onMakeGoal,
  onCopyToTransaction,
  disabled = false,
}: WishlistCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const hasImage = Boolean(item.image_url);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (disabled) {
      setMenuOpen(false);
    }
  }, [disabled]);

  const priorityBadge = useMemo(() => {
    const value = item.priority != null ? Math.round(item.priority) : null;
    if (!value || value < 1 || value > 5) return null;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[value]}`}
      >
        Prioritas {value}
      </span>
    );
  }, [item.priority]);

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl bg-slate-950/80 ring-1 ring-slate-800 transition hover:ring-[var(--accent)]/70 ${
        selected ? 'ring-2 ring-[var(--accent)]/80' : ''
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {hasImage ? (
        <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
          <img
            src={item.image_url ?? ''}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <label className="mt-0.5 flex items-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectChange(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Pilih wishlist ${item.title}`}
              disabled={disabled}
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-slate-100">{item.title}</h3>
              <div className="flex items-center gap-2">
                {priorityBadge}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="font-medium text-slate-100">{formatCurrencyIDR(item.estimated_price)}</span>
              {item.category?.name ? <span className="text-xs uppercase tracking-wide text-slate-500">{item.category.name}</span> : null}
              {item.store_url ? (
                <a
                  href={item.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent)] transition hover:text-[var(--accent)]/80"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Toko
                </a>
              ) : null}
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Menu tindakan untuk ${item.title}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              disabled={disabled}
            >
              <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/95 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMakeGoal(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-900"
                >
                  <Goal className="h-4 w-4" aria-hidden="true" /> Jadikan Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMarkPurchased(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-900"
                  disabled={item.status === 'purchased'}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Tandai Dibeli
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onCopyToTransaction(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-900"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Salin ke Transaksi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-900"
                >
                  <NotebookPen className="h-4 w-4" aria-hidden="true" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {item.note ? (
          <p className="line-clamp-3 text-sm text-slate-400">{item.note}</p>
        ) : null}
      </div>
    </article>
  );
}
