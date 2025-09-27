/**
 * WishlistCard presents one wishlist item with thumbnail, price summary, status badge,
 * and quick action icons. It exposes callbacks for selection, editing, deleting, and
 * navigation actions so the parent page can coordinate optimistic updates.
 */
import clsx from 'clsx';
import type { WishlistItem, WishlistStatus } from '../../lib/wishlistApi';
import {
  IconEdit,
  IconTrash,
  IconCheckCircle,
  IconGoalFlag,
  IconCopy,
} from '../icons/WishlistIcons';

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
  planned: 'bg-slate-800 text-slate-300',
  deferred: 'bg-amber-900/40 text-amber-300',
  purchased: 'bg-emerald-900/40 text-emerald-300',
  archived: 'bg-slate-800/60 text-slate-400',
};

const PRIORITY_STYLE: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-200',
  2: 'bg-teal-500/20 text-teal-200',
  3: 'bg-sky-500/20 text-sky-200',
  4: 'bg-violet-500/20 text-violet-200',
  5: 'bg-rose-500/20 text-rose-200',
};

function formatCurrency(value: number | null): string {
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
  const priorityValue = item.priority != null && item.priority >= 1 && item.priority <= 5 ? item.priority : null;

  return (
    <article
      className={clsx(
        'group flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/90 ring-1 ring-slate-800 transition hover:ring-[var(--accent)]/70',
        selected && 'ring-2 ring-[var(--accent)]/80',
        disabled && 'opacity-60'
      )}
    >
      <div className="relative">
        <div className="aspect-video w-full overflow-hidden bg-slate-950">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-xs uppercase tracking-wide text-slate-600">
              Tidak ada gambar
            </div>
          )}
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <label className="inline-flex items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectChange(event.target.checked)}
              disabled={disabled}
              className="h-5 w-5 cursor-pointer rounded border-slate-600 bg-slate-950/80 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Pilih wishlist ${item.title}`}
            />
          </label>
          {priorityValue ? (
            <span
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shadow-sm',
                PRIORITY_STYLE[priorityValue]
              )}
            >
              {priorityValue}
            </span>
          ) : null}
        </div>
        <div className="absolute right-3 top-3">
          <span
            className={clsx(
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium shadow-sm',
              STATUS_STYLE[item.status]
            )}
          >
            {STATUS_LABEL[item.status]}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-base font-semibold text-slate-100 line-clamp-2">{item.title}</h3>
        </div>
        {item.note ? <p className="line-clamp-3 text-sm text-slate-400">{item.note}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-sm text-slate-100">{formatCurrency(item.estimated_price)}</span>
            {item.store_url ? (
              <a
                href={item.store_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent)] transition hover:text-[var(--accent)]/80"
              >
                Lihat toko
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Edit ${item.title}`}
              disabled={disabled}
            >
              <IconEdit className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMarkPurchased(item)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 transition hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Tandai ${item.title} sebagai dibeli`}
              disabled={disabled || item.status === 'purchased'}
            >
              <IconCheckCircle className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMakeGoal(item)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Jadikan ${item.title} sebagai goal`}
              disabled={disabled}
            >
              <IconGoalFlag className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onCopyToTransaction(item)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-slate-200 transition hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Salin ${item.title} ke transaksi`}
              disabled={disabled}
            >
              <IconCopy className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-900/30 text-rose-200 transition hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Hapus ${item.title}`}
              disabled={disabled}
            >
              <IconTrash className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          {item.category?.name ? <span>{item.category.name}</span> : <span className="italic text-slate-600">Tanpa kategori</span>}
          <time dateTime={item.created_at} className="text-[11px] text-slate-600">
            {new Date(item.created_at).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
          </time>
        </div>
      </div>
    </article>
  );
}
