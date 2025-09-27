import type { MouseEvent } from 'react';
import type { WishlistItem, WishlistStatus } from '../../lib/wishlistApi';

interface WishlistCardProps {
  item: WishlistItem;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
  onEdit: (item: WishlistItem, event: MouseEvent<HTMLButtonElement>) => void;
  onDelete: (item: WishlistItem) => void;
  onMarkPurchased: (item: WishlistItem) => void;
  onMakeGoal: (item: WishlistItem) => void;
  onCopyToTransaction: (item: WishlistItem) => void;
  disabled?: boolean;
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 17.25V21h3.75L20.81 6.94a1.5 1.5 0 000-2.12L19.18 3.19a1.5 1.5 0 00-2.12 0L4.5 15.75"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.75 4.25l3 3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 13a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5l2.5 2.5 4.5-4.5" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4a1 1 0 011-1h9.5l-.75 2h3.25a1 1 0 01.95 1.31L18 11l1.95 4.69a1 1 0 01-.95 1.31H6" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7v7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 3l-9.5 9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" />
    </svg>
  );
}

const STATUS_LABEL: Record<WishlistStatus, string> = {
  planned: 'Direncanakan',
  deferred: 'Ditunda',
  purchased: 'Dibeli',
  archived: 'Diarsipkan',
};

const STATUS_STYLE: Record<WishlistStatus, string> = {
  planned: 'bg-slate-800/60 text-slate-100 ring-1 ring-slate-700/80',
  deferred: 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/30',
  purchased: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/30',
  archived: 'bg-slate-900/70 text-slate-400 ring-1 ring-slate-700/60',
};

const PRIORITY_STYLE: Record<number, string> = {
  1: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30',
  2: 'bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30',
  3: 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/30',
  4: 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30',
  5: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30',
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
  const hasPriority = item.priority != null && item.priority >= 1 && item.priority <= 5;

  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/60 ring-1 ring-slate-800 transition hover:ring-[var(--accent)]/60 ${
        selected ? 'ring-[var(--accent)]/80' : ''
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {item.image_url ? (
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950/60">
          <img
            src={item.image_url}
            alt={item.title}
            className="h-full w-full object-cover transition duration-500 ease-out hover:scale-[1.02]"
            loading="lazy"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-tight text-slate-100 line-clamp-2">{item.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {hasPriority ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  PRIORITY_STYLE[item.priority ?? 1]
                }`}
                >
                  Prioritas {item.priority}
                </span>
              ) : null}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[item.status]}`}
              >
                {STATUS_LABEL[item.status]}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-semibold text-slate-100">
                {formatCurrencyIDR(item.estimated_price)}
              </span>
              {item.category?.name ? (
                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-300">
                  {item.category.name}
                </span>
              ) : null}
              {item.store_url ? (
                <a
                  href={item.store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-slate-800/50 px-2.5 py-1 text-xs text-[var(--accent)] transition hover:text-[var(--accent)]/80"
                >
                  <ExternalIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Lihat toko
                </a>
              ) : null}
            </div>
            {item.note ? <p className="line-clamp-2 text-sm text-slate-400">{item.note}</p> : null}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-slate-200">
            <button
              type="button"
              onClick={(event) => onEdit(item, event)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/70 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Edit ${item.title}`}
              disabled={disabled}
            >
              <PencilIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/70 text-rose-300 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              aria-label={`Hapus ${item.title}`}
              disabled={disabled}
            >
              <TrashIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onMarkPurchased(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/70 text-emerald-300 transition hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label={`Tandai ${item.title} sudah dibeli`}
              disabled={disabled || item.status === 'purchased'}
            >
              <CheckCircleIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onMakeGoal(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/70 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Jadikan ${item.title} sebagai goal`}
              disabled={disabled}
            >
              <FlagIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onCopyToTransaction(item)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/70 text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Salin ${item.title} ke transaksi`}
              disabled={disabled}
            >
              <CopyIcon className="h-5 w-5" />
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectChange(event.target.checked)}
              className="h-5 w-5 cursor-pointer rounded-lg border border-slate-600 bg-slate-950 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              disabled={disabled}
              aria-label={`Pilih ${item.title}`}
            />
            Pilih
          </label>
        </div>
      </div>
    </article>
  );
}
