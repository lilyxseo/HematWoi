/**
 * WishlistCard menampilkan ringkasan satu item wishlist berikut aksi cepat dan checkbox seleksi.
 * Komponen menerima data item dan callback untuk edit, hapus, ubah status, serta navigasi ke goal/transaksi.
 */
import clsx from 'clsx';
import { useMemo, type ReactNode } from 'react';
import type { WishlistItem, WishlistStatus } from '../../lib/wishlistApi';
import {
  IconCheckCircle,
  IconCopy,
  IconEdit,
  IconGoalFlag,
  IconImage,
  IconTrash,
} from './WishlistIcons';

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

const STATUS_CLASS: Record<WishlistStatus, string> = {
  planned: 'bg-slate-800 text-slate-300',
  deferred: 'bg-amber-900/40 text-amber-300',
  purchased: 'bg-emerald-900/40 text-emerald-300',
  archived: 'bg-slate-800/60 text-slate-400',
};

const PRIORITY_CLASS: Record<number, string> = {
  1: 'bg-emerald-900/40 text-emerald-200',
  2: 'bg-teal-900/40 text-teal-200',
  3: 'bg-sky-900/40 text-sky-200',
  4: 'bg-violet-900/40 text-violet-200',
  5: 'bg-rose-900/50 text-rose-200 font-semibold',
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
  const priority = useMemo(() => {
    const value = item.priority != null ? Math.round(item.priority) : null;
    if (!value || value < 1 || value > 5) return null;
    return value as 1 | 2 | 3 | 4 | 5;
  }, [item.priority]);

  const statusBadge = STATUS_LABEL[item.status];

  return (
    <article
      className={clsx(
        'flex h-full flex-col rounded-2xl bg-slate-900/80 p-4 ring-1 ring-slate-800 transition hover:ring-[var(--accent)]/70',
        selected && 'ring-2 ring-[var(--accent)]/80',
        disabled && 'opacity-60'
      )}
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-950">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-slate-950 text-slate-600">
            <IconImage className="h-10 w-10" aria-hidden="true" />
          </div>
        )}
        <span
          className={clsx(
            'absolute left-3 top-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
            STATUS_CLASS[item.status]
          )}
        >
          {statusBadge}
        </span>
        <label className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/70 text-slate-100 ring-2 ring-slate-700 transition hover:text-[var(--accent)] focus-within:ring-[var(--accent)]">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={selected}
            onChange={(event) => onSelectChange(event.target.checked)}
            aria-label={selected ? 'Batalkan pilihan wishlist' : 'Pilih wishlist'}
            disabled={disabled}
          />
          <span
            aria-hidden="true"
            className={clsx(
              'grid h-5 w-5 place-items-center rounded-full text-xs font-semibold transition',
              selected ? 'bg-[var(--accent)] text-slate-950' : 'bg-slate-800 text-slate-300'
            )}
          >
            ✓
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
            {item.note ? <p className="line-clamp-2 text-sm text-slate-400">{item.note}</p> : null}
          </div>
          {priority ? (
            <span
              className={clsx(
                'grid h-9 w-9 place-items-center rounded-full text-sm shadow-inner',
                PRIORITY_CLASS[priority]
              )}
              aria-label={`Prioritas ${priority}`}
            >
              {priority}
            </span>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-[0.95rem] text-slate-200">{formatCurrencyIDR(item.estimated_price)}</span>
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
        </div>

        <div className="flex flex-wrap gap-2">
          <QuickActionButton
            icon={<IconEdit className="h-4 w-4" aria-hidden="true" />}
            label="Edit wishlist"
            onClick={() => onEdit(item)}
            disabled={disabled}
          />
          <QuickActionButton
            icon={<IconTrash className="h-4 w-4" aria-hidden="true" />}
            label="Hapus wishlist"
            variant="danger"
            onClick={() => onDelete(item)}
            disabled={disabled}
          />
          <QuickActionButton
            icon={<IconCheckCircle className="h-4 w-4" aria-hidden="true" />}
            label="Tandai dibeli"
            onClick={() => onMarkPurchased(item)}
            disabled={disabled || item.status === 'purchased'}
          />
          <QuickActionButton
            icon={<IconGoalFlag className="h-4 w-4" aria-hidden="true" />}
            label="Jadikan goal"
            onClick={() => onMakeGoal(item)}
            disabled={disabled}
          />
          <QuickActionButton
            icon={<IconCopy className="h-4 w-4" aria-hidden="true" />}
            label="Salin ke transaksi"
            onClick={() => onCopyToTransaction(item)}
            disabled={disabled}
          />
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-slate-500">
          <span>Diperbarui {new Date(item.updated_at).toLocaleDateString('id-ID')}</span>
          {item.category ? <span className="rounded-full bg-slate-800/70 px-2 py-1 text-[0.7rem]">{item.category.name}</span> : null}
        </div>
      </div>
    </article>
  );
}

interface QuickActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

function QuickActionButton({ icon, label, onClick, variant = 'default', disabled }: QuickActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-2 rounded-full px-3 text-xs font-medium transition',
        variant === 'danger'
          ? 'bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
          : 'bg-slate-900/70 text-slate-200 hover:text-[var(--accent)]',
        'ring-2 ring-slate-800 focus-visible:outline-none focus-visible:ring-[var(--accent)]',
        disabled && 'pointer-events-none opacity-50'
      )}
      aria-label={label}
      disabled={disabled}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
