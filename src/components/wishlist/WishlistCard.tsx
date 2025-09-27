/**
 * WishlistCard shows wishlist metadata, image, and inline action icons for a single item.
 * It supports selection for batch actions and exposes callbacks for quick mutations.
 */
import clsx from 'clsx';
import { useMemo } from 'react';
import type { WishlistItem } from '../../lib/wishlistApi';
import {
  IconCheckCircle,
  IconCopy,
  IconEdit,
  IconGoalFlag,
  IconTrash,
} from './icons';

export interface WishlistCardProps {
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

const STATUS_LABEL: Record<WishlistItem['status'], string> = {
  planned: 'Direncanakan',
  deferred: 'Ditunda',
  purchased: 'Dibeli',
  archived: 'Diarsipkan',
};

const STATUS_CLASS: Record<WishlistItem['status'], string> = {
  planned: 'bg-slate-800 text-slate-300',
  deferred: 'bg-amber-900/40 text-amber-300',
  purchased: 'bg-emerald-900/40 text-emerald-300',
  archived: 'bg-slate-800/60 text-slate-400',
};

function formatCurrencyIDR(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getPriorityClass(priority: number) {
  switch (priority) {
    case 5:
      return 'bg-rose-500/15 text-rose-200';
    case 4:
      return 'bg-violet-500/15 text-violet-200';
    case 3:
      return 'bg-sky-500/15 text-sky-200';
    case 2:
      return 'bg-teal-500/15 text-teal-200';
    case 1:
    default:
      return 'bg-emerald-500/15 text-emerald-300';
  }
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
  const priorityBadge = useMemo(() => {
    if (item.priority == null || item.priority < 1 || item.priority > 5) {
      return null;
    }
    return (
      <span
        className={clsx(
          'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold',
          getPriorityClass(item.priority)
        )}
      >
        {item.priority}
      </span>
    );
  }, [item.priority]);

  return (
    <article
      className={clsx(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/80 ring-1 ring-slate-800 transition',
        'hover:ring-slate-700',
        disabled && 'pointer-events-none opacity-60',
        selected && 'ring-2 ring-[var(--accent)]/80'
      )}
    >
      {item.image_url ? (
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="aspect-video w-full bg-slate-950/70" aria-hidden="true" />
      )}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <label className="mt-1 flex items-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectChange(event.target.checked)}
              className="h-5 w-5 cursor-pointer rounded border-slate-600 bg-slate-900 text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label={`Pilih wishlist ${item.title}`}
              disabled={disabled}
            />
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-slate-100">{item.title}</h3>
              <div className="flex items-center gap-2">
                {priorityBadge}
                <span
                  className={clsx(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
                    STATUS_CLASS[item.status]
                  )}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
              <span className="font-mono text-sm text-slate-100">{formatCurrencyIDR(item.estimated_price)}</span>
              {item.store_url ? (
                <a
                  href={item.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent)] underline-offset-4 hover:underline"
                >
                  Lihat toko
                </a>
              ) : null}
              {item.category?.name ? (
                <span className="text-xs text-slate-500">{item.category.name}</span>
              ) : null}
            </div>
          </div>
        </div>
        {item.note ? <p className="line-clamp-3 text-sm text-slate-400">{item.note}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <time className="text-xs text-slate-500" dateTime={item.created_at}>
            Dibuat {new Date(item.created_at).toLocaleDateString('id-ID')}
          </time>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onMakeGoal(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 transition hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label="Jadikan goal"
            >
              <IconGoalFlag className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMarkPurchased(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 transition hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label="Tandai dibeli"
              disabled={item.status === 'purchased'}
            >
              <IconCheckCircle className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onCopyToTransaction(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 transition hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label="Salin ke transaksi"
            >
              <IconCopy className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 transition hover:text-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              aria-label="Edit wishlist"
            >
              <IconEdit className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
              aria-label="Hapus wishlist"
            >
              <IconTrash className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
