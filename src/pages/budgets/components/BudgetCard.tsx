import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Flame,
  NotebookPen,
  Pencil,
  RefreshCcw,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import type { BudgetWithSpent } from '../../../lib/budgetApi';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

function getStatus(remaining: number, progress: number) {
  if (remaining < 0) {
    return {
      label: 'Melebihi batas',
      icon: Flame,
      badgeClass:
        'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/30 dark:text-rose-200 dark:ring-rose-500/40',
      message: `Pengeluaran sudah melebihi anggaran sebesar ${formatCurrency(Math.abs(remaining))}.`,
    } as const;
  }

  if (progress >= 90) {
    return {
      label: 'Hampir habis',
      icon: AlertTriangle,
      badgeClass:
        'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/30 dark:text-amber-200 dark:ring-amber-500/40',
      message: `Sisa dana tinggal ${formatCurrency(remaining)} — waktunya rem pengeluaran.`,
    } as const;
  }

  return {
    label: 'Sehat',
    icon: CheckCircle2,
    badgeClass:
      'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-200 dark:ring-emerald-500/40',
    message: `Masih tersedia ${formatCurrency(remaining)} dari anggaran ini.`,
  } as const;
}

function getProgressTone(progress: number) {
  if (progress <= 74) return 'bg-[color:var(--accent)]';
  if (progress <= 89) return 'bg-amber-500';
  if (progress <= 100) return 'bg-orange-500';
  return 'bg-rose-500';
}

interface BudgetCardProps {
  budget: BudgetWithSpent;
  isHighlighted: boolean;
  onViewTransactions: () => void;
  onToggleHighlight: () => void;
  onToggleCarryover: (carryover: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function StatItem({
  label,
  value,
  description,
  valueClassName,
}: {
  label: string;
  value: string;
  description?: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs md:text-sm leading-snug text-muted-foreground whitespace-nowrap">{label}</p>
      <p className={clsx('text-lg md:text-xl font-bold tabular-nums truncate', valueClassName)}>{value}</p>
      {description ? (
        <p className="text-xs md:text-sm leading-snug text-muted-foreground/90 line-clamp-1">{description}</p>
      ) : null}
    </div>
  );
}

export default function BudgetCard({
  budget,
  isHighlighted,
  onViewTransactions,
  onToggleHighlight,
  onToggleCarryover,
  onEdit,
  onDelete,
}: BudgetCardProps) {
  const planned = Number(budget.amount_planned ?? 0);
  const spent = Number(budget.spent ?? 0);
  const remaining = Number.isFinite(Number(budget.remaining))
    ? Number(budget.remaining)
    : planned - spent;
  const rawProgress = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 200 : 0;
  const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
  const status = getStatus(remaining, progress);
  const StatusIcon = status.icon;
  const progressTone = getProgressTone(rawProgress);
  const carryoverEnabled = Boolean(budget.carryover_enabled);
  const categoryName = budget.category?.name ?? 'Tanpa kategori';
  const categoryInitial = categoryName.trim().charAt(0).toUpperCase() || 'B';
  const categoryType = budget.category?.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  const categoryTypeClass =
    budget.category?.type === 'income'
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
      : 'bg-rose-500/10 text-rose-600 dark:text-rose-300';
  const notes = budget.notes?.trim();
  const percentageLabel =
    planned > 0 ? `${Math.min(100, Math.round((spent / planned) * 100))}% dari anggaran` : 'Tidak ada batas';
  const remainingLabel = remaining < 0 ? 'Perlu tindakan' : 'Masih tersedia';

  return (
    <article
      className={clsx(
        'relative grid min-h-[280px] md:min-h-[300px] grid-rows-[auto,auto,1fr,auto] gap-3 overflow-hidden rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-[0_24px_45px_-28px_rgba(15,23,42,0.5)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_30px_60px_-32px_rgba(15,23,42,0.55)] backdrop-blur supports-[backdrop-filter]:bg-surface/60 md:p-5 xl:p-6',
        isHighlighted
          ? 'border-brand/60 bg-gradient-to-br from-brand/15 via-surface/80 to-surface/80 ring-2 ring-brand/40 shadow-[0_32px_64px_-36px_rgba(59,130,246,0.55)] dark:from-brand/25'
          : null,
      )}
    >
      {isHighlighted ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle at center, rgba(59,130,246,0.45) 0%, rgba(59,130,246,0.2) 45%, rgba(255,255,255,0) 75%)',
          }}
        />
      ) : null}
      <header className="relative z-10 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-lg font-semibold uppercase text-brand shadow-inner">
          {categoryInitial}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base md:text-lg font-semibold leading-tight tracking-tight text-text line-clamp-1 md:line-clamp-2 break-words">
              {categoryName}
            </h3>
            <span
              className={clsx(
                'inline-flex items-center shrink-0 rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide',
                categoryTypeClass,
              )}
            >
              {categoryType}
            </span>
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide shadow-sm backdrop-blur',
                status.badgeClass,
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {status.label}
            </span>
            {isHighlighted ? (
              <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-brand/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-brand shadow-sm ring-1 ring-[color:var(--brand-ring)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Highlight
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3 text-xs md:text-sm leading-snug text-muted-foreground">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="line-clamp-2 break-words">{status.message}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80 whitespace-nowrap">
            Periode {budget.period_month?.slice(0, 7) ?? '-'}
          </p>
          {notes ? (
            <p className="flex items-start gap-2 text-xs md:text-sm leading-snug text-muted-foreground/90 line-clamp-2 break-words">
              <NotebookPen className="mt-[2px] h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
              <span>{notes}</span>
            </p>
          ) : null}
        </div>
        <div className="flex h-10 shrink-0 items-center gap-3 rounded-full border border-white/10 bg-surface/70 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-inner">
          <RefreshCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline whitespace-nowrap">Carryover</span>
          <span className="sm:hidden">CO</span>
          <label className="relative inline-flex h-6 w-11 cursor-pointer items-center" aria-label={`Atur carryover untuk ${categoryName}`}>
            <input
              type="checkbox"
              checked={carryoverEnabled}
              onChange={(event) => onToggleCarryover(event.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-muted/30 transition peer-checked:bg-emerald-500/60" />
            <span className="relative ml-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 dark:bg-zinc-900" />
          </label>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          <StatItem label="Dialokasikan" value={formatCurrency(planned)} description="Anggaran" />
          <StatItem label="Terpakai" value={formatCurrency(spent)} description={percentageLabel} />
          <StatItem
            label="Sisa"
            value={formatCurrency(remaining)}
            description={remainingLabel}
            valueClassName={remaining < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}
          />
        </div>
        <div className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-surface/50 p-3 shadow-inner lg:min-w-[200px] lg:max-w-[260px]">
          <div className="flex items-center justify-between text-xs md:text-sm leading-snug text-muted-foreground">
            <span>Progres penggunaan</span>
            <span className="tabular-nums whitespace-nowrap">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
            <div
              role="progressbar"
              aria-label={`Anggaran terpakai ${progress}%`}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className={clsx('h-full rounded-full transition-[width]', progressTone)}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <footer className="relative z-10 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onViewTransactions}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/80 text-muted-foreground transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          aria-label={`Lihat transaksi untuk ${categoryName}`}
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggleHighlight}
          aria-pressed={isHighlighted}
          aria-label={`${isHighlighted ? 'Hapus' : 'Tambah'} highlight untuk ${categoryName}`}
          className={clsx(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]',
            isHighlighted
              ? 'border-brand/40 bg-brand/15 text-brand shadow-sm'
              : 'border-white/10 bg-surface/80 text-muted-foreground hover:text-text shadow-sm',
          )}
        >
          <Star className="h-4 w-4" aria-hidden="true" fill={isHighlighted ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/80 text-muted-foreground transition hover:text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          aria-label={`Edit ${categoryName}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500 transition hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 dark:border-rose-500/30 dark:text-rose-200"
          aria-label={`Hapus ${categoryName}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
}
