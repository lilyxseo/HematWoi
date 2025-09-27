import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleDollarSign,
  EllipsisVertical,
  Goal,
  Link2,
  NotebookPen,
  ShoppingBag,
  Star,
  StickyNote,
  Tag,
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
  planned:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30',
  deferred:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30',
  purchased:
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30',
  archived:
    'bg-surface-2 text-muted ring-border-subtle dark:bg-slate-900/70 dark:text-slate-400 dark:ring-slate-700/60',
};

const PRIORITY_STYLE: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30',
  2: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-500/30',
  3: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30',
  4: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/30',
  5: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30',
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
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${PRIORITY_STYLE[value]}`}
      >
        <Star className="h-3.5 w-3.5" aria-hidden="true" /> Prioritas {value}
      </span>
    );
  }, [item.priority]);

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-border-subtle transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-[var(--accent)]/40 ${
        selected ? 'ring-2 ring-[var(--accent)]/70 shadow-lg' : ''
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {hasImage ? (
        <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
          <img
            src={item.image_url ?? ''}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-surface-2 text-muted">
          <ShoppingBag className="h-8 w-8" aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <label className="mt-0.5 flex items-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectChange(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-border-subtle bg-background text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Pilih wishlist ${item.title}`}
              disabled={disabled}
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-text">{item.title}</h3>
              <div className="flex items-center gap-2">
                {priorityBadge}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <div className="flex items-center gap-2 text-text">
                <CircleDollarSign className="h-4 w-4 text-muted" aria-hidden="true" />
                <span className="font-medium">{formatCurrencyIDR(item.estimated_price)}</span>
              </div>
              {item.category?.name ? (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted" aria-hidden="true" />
                  <span className="text-sm font-medium text-text">{item.category.name}</span>
                </div>
              ) : null}
              {item.store_url ? (
                <a
                  href={item.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] transition hover:text-[var(--accent)]/80"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" /> Kunjungi toko
                </a>
              ) : null}
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Menu tindakan untuk ${item.title}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              disabled={disabled}
            >
              <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMakeGoal(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition hover:bg-surface-2"
                >
                  <Goal className="h-4 w-4" aria-hidden="true" /> Jadikan Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMarkPurchased(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition hover:bg-surface-2 disabled:opacity-50"
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
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition hover:bg-surface-2"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Salin ke Transaksi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition hover:bg-surface-2"
                >
                  <NotebookPen className="h-4 w-4" aria-hidden="true" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger transition hover:bg-danger/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {item.note ? (
          <div className="flex items-start gap-2 rounded-2xl bg-surface-2/70 p-3 text-sm text-muted">
            <StickyNote className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
            <p className="line-clamp-3 text-left text-sm text-muted">{item.note}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
