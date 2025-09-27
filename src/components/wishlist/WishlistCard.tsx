import { useMemo, type SVGProps } from 'react';
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

const ACTION_BUTTON_CLASS =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800/70 bg-slate-950 text-slate-200 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50';

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20z" />
      <path strokeLinecap="round" d="M14.5 6.5 17 9" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V4h6v3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7v11a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7" />
    </svg>
  );
}

function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 11.5a9.5 9.5 0 1 1-9.5-9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12.5 2.5 2.5 6-8" />
    </svg>
  );
}

function FlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4h9l-1 3h6l-1 3h-6l1 3H5" />
    </svg>
  );
}

function CopyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4H5v14h10z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 8v12H9" />
    </svg>
  );
}

function ExternalLinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14 20 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

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
  const hasImage = Boolean(item.image_url);

  const priorityBadge = useMemo(() => {
    const value = item.priority != null ? Math.round(item.priority) : null;
    if (!value || value < 1 || value > 5) return null;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLE[value]}`}>
        Prioritas {value}
      </span>
    );
  }, [item.priority]);

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-slate-950/80 ring-1 ring-slate-800 transition hover:ring-[var(--accent)]/60 ${
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
          <label className="mt-0.5 inline-flex items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectChange(event.target.checked)}
              className="h-5 w-5 cursor-pointer rounded border-slate-600 bg-slate-950 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Pilih wishlist ${item.title}`}
              disabled={disabled}
            />
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="truncate text-base font-semibold text-slate-100">{item.title}</h3>
              <div className="flex flex-wrap items-center gap-2">
                {priorityBadge}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="font-mono text-slate-100">{formatCurrencyIDR(item.estimated_price)}</span>
              {item.category?.name ? (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-500">
                  {item.category.name}
                </span>
              ) : null}
              {item.store_url ? (
                <a
                  href={item.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent)] transition hover:text-[var(--accent)]/80"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" /> Toko
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {item.note ? <p className="line-clamp-2 text-sm text-slate-400">{item.note}</p> : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className={ACTION_BUTTON_CLASS}
              aria-label={`Edit ${item.title}`}
              disabled={disabled}
            >
              <PencilIcon className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className={`${ACTION_BUTTON_CLASS} hover:text-rose-400 focus-visible:ring-rose-400`}
              aria-label={`Hapus ${item.title}`}
              disabled={disabled}
            >
              <TrashIcon className="h-4 w-4" />
              <span className="sr-only">Hapus</span>
            </button>
            <button
              type="button"
              onClick={() => onMarkPurchased(item)}
              className={ACTION_BUTTON_CLASS}
              aria-label={`Tandai ${item.title} sudah dibeli`}
              disabled={disabled || item.status === 'purchased'}
            >
              <CheckCircleIcon className="h-4 w-4" />
              <span className="sr-only">Tandai dibeli</span>
            </button>
            <button
              type="button"
              onClick={() => onMakeGoal(item)}
              className={ACTION_BUTTON_CLASS}
              aria-label={`Jadikan ${item.title} sebagai goal`}
              disabled={disabled}
            >
              <FlagIcon className="h-4 w-4" />
              <span className="sr-only">Jadikan goal</span>
            </button>
            <button
              type="button"
              onClick={() => onCopyToTransaction(item)}
              className={ACTION_BUTTON_CLASS}
              aria-label={`Salin ${item.title} ke transaksi`}
              disabled={disabled}
            >
              <CopyIcon className="h-4 w-4" />
              <span className="sr-only">Salin ke transaksi</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
