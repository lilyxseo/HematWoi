import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleDollarSign,
  EllipsisVertical,
  ExternalLink,
  Folder,
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
  planned: 'border border-brand/30 bg-brand/10 text-brand',
  deferred: 'border border-warning/30 bg-warning/20 text-warning',
  purchased: 'border border-success/30 bg-success/20 text-success',
  archived: 'border border-border-subtle bg-surface-alt/80 text-muted',
};

const PRIORITY_STYLE: Record<number, string> = {
  1: 'border border-success/30 bg-success/20 text-success',
  2: 'border border-info/30 bg-info/20 text-info',
  3: 'border border-brand/30 bg-brand/10 text-brand',
  4: 'border border-warning/30 bg-warning/20 text-warning',
  5: 'border border-danger/30 bg-danger/20 text-danger',
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
      className={`group relative flex h-full flex-col rounded-3xl border border-border-subtle bg-surface shadow-sm transition-all duration-200 hover:border-brand/40 hover:shadow-lg ${
        selected ? 'border-brand/60 ring-2 ring-brand/40' : 'ring-1 ring-transparent'
      } ${menuOpen ? 'z-20' : ''} ${disabled ? 'opacity-60' : ''}`}
    >
      {hasImage ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-t-3xl bg-surface-alt">
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
              className="h-4 w-4 cursor-pointer rounded border-border-subtle bg-surface-alt text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1 font-semibold text-text">
                <CircleDollarSign className="h-4 w-4 text-brand" aria-hidden="true" />
                {formatCurrencyIDR(item.estimated_price)}
              </span>
              {item.category?.name ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted">
                  <Folder className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.category.name}
                </span>
              ) : null}
              {item.store_url ? (
                <a
                  href={item.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition hover:text-brand/80"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Kunjungi toko
                </a>
              ) : null}
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-surface-alt/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              aria-label={`Menu tindakan untuk ${item.title}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              disabled={disabled}
            >
              <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-2xl border border-border-subtle bg-surface-elevated shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMakeGoal(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition hover:bg-surface-alt"
                >
                  <Goal className="h-4 w-4" aria-hidden="true" /> Jadikan Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onMarkPurchased(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition hover:bg-surface-alt"
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
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition hover:bg-surface-alt"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Salin ke Transaksi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(item);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text transition hover:bg-surface-alt"
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
          <p className="line-clamp-3 text-sm text-muted">{item.note}</p>
        ) : null}
      </div>
    </article>
  );
}
