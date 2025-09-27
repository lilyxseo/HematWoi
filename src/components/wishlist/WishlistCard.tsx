import type { ReactNode } from 'react';
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
  planned: 'bg-slate-800/80 text-slate-200 ring-1 ring-slate-700/60',
  deferred: 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/30',
  purchased: 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/30',
  archived: 'bg-slate-800/70 text-slate-400 ring-1 ring-slate-700/60',
};

const PRIORITY_STYLE: Record<number, string> = {
  1: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40',
  2: 'bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/40',
  3: 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-400/40',
  4: 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/40',
  5: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/40',
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
  const priority = item.priority != null ? Math.round(item.priority) : null;
  const statusLabel = STATUS_LABEL[item.status];

  const categoryName = item.category?.name;
  const displayPrice = formatCurrencyIDR(item.estimated_price);

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/80 ring-1 ring-slate-800 transition hover:ring-[var(--accent)]/60 ${
        selected ? 'ring-2 ring-[var(--accent)]/80' : ''
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {item.image_url ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-950/70">
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-100 line-clamp-2">{item.title}</h3>
            <div className="flex items-center gap-2">
              {priority && priority >= 1 && priority <= 5 ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${PRIORITY_STYLE[priority]}`}
                >
                  Prioritas {priority}
                </span>
              ) : null}
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[item.status]}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <span className="rounded-full bg-slate-800/70 px-2.5 py-1 font-mono text-sm text-slate-100">
              {displayPrice}
            </span>
            {categoryName ? <span className="rounded-full bg-slate-800/70 px-2.5 py-1 text-slate-300">{categoryName}</span> : null}
            {item.store_url ? (
              <a
                href={item.store_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-slate-800/70 px-2.5 py-1 text-[var(--accent)] transition hover:bg-slate-800 hover:text-[var(--accent)]"
              >
                <ExternalIcon /> Toko
              </a>
            ) : null}
          </div>

          {item.note ? (
            <p className="line-clamp-3 text-sm text-slate-400">{item.note}</p>
          ) : null}
        </div>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelectChange(event.target.checked)}
              className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label={`Pilih ${item.title}`}
              disabled={disabled}
            />
            Pilih
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <IconButton
              onClick={() => onMakeGoal(item)}
              ariaLabel={`Jadikan goal ${item.title}`}
              disabled={disabled}
            >
              <FlagIcon />
            </IconButton>
            <IconButton
              onClick={() => onMarkPurchased(item)}
              ariaLabel={`Tandai ${item.title} sudah dibeli`}
              disabled={disabled || item.status === 'purchased'}
            >
              <CheckIcon />
            </IconButton>
            <IconButton
              onClick={() => onCopyToTransaction(item)}
              ariaLabel={`Salin ${item.title} ke transaksi`}
              disabled={disabled}
            >
              <CopyIcon />
            </IconButton>
            <IconButton onClick={() => onEdit(item)} ariaLabel={`Edit ${item.title}`} disabled={disabled}>
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={() => onDelete(item)}
              ariaLabel={`Hapus ${item.title}`}
              disabled={disabled}
              tone="danger"
            >
              <TrashIcon />
            </IconButton>
          </div>
        </footer>
      </div>
    </article>
  );
}

interface IconButtonProps {
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  children: ReactNode;
  tone?: 'default' | 'danger';
}

function IconButton({ onClick, ariaLabel, disabled = false, tone = 'default', children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        tone === 'danger'
          ? 'border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
          : 'border-slate-700/80 hover:border-[var(--accent)]/60 hover:text-[var(--accent)]'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7v7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 3-9 9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h6M5 19h14V9" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5v16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h9l-1.5 3 1.5 3H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <rect x="9" y="9" width="11" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 21 4.5-1.5L19 9l-3-3L5.5 16.5 4 21z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m14 5 3 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m10 11 1 8m4-8-1 8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
    </svg>
  );
}
