import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Flame,
  Pencil,
  RefreshCcw,
  Sparkles,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type { BudgetWithSpent } from '../../../lib/budgetApi';
import { formatCurrency } from '../../../lib/format';

type StatusTone = 'danger' | 'warning' | 'caution' | 'ok';

interface BudgetStatusMeta {
  label: string;
  badgeClass: string;
  summary: string;
  insight: string;
  icon: LucideIcon;
  tone: StatusTone;
}

interface BudgetCardProps {
  row: BudgetWithSpent;
  highlighted: boolean;
  disableHighlight: boolean;
  onToggleCarryover: (carryover: boolean) => void;
  onViewTransactions: () => void;
  onToggleHighlight: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });

function getProgressPercentage(planned: number, spent: number): number {
  if (planned <= 0) {
    return spent > 0 ? 200 : 0;
  }

  return (spent / planned) * 100;
}

function getStatusMeta(percentage: number, remaining: number, planned: number): BudgetStatusMeta {
  const displayRemaining = formatCurrency(Math.abs(remaining), 'IDR');

  if (remaining < 0) {
    return {
      label: 'Melebihi batas',
      badgeClass:
        'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200',
      summary: 'Pengeluaran melebihi batas anggaran. Segera tinjau transaksi terbaru.',
      insight: `Pengeluaran sudah melampaui anggaran sebesar ${displayRemaining}.`,
      icon: Flame,
      tone: 'danger',
    };
  }

  if (percentage >= 90) {
    return {
      label: 'Hampir habis',
      badgeClass:
        'bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200',
      summary: `Penggunaan sudah mencapai ${Math.round(Math.min(percentage, 100))}% dari rencana.`,
      insight: `Sisa dana hanya ${formatCurrency(remaining, 'IDR')} — prioritaskan kebutuhan utama.`,
      icon: AlertTriangle,
      tone: 'warning',
    };
  }

  if (percentage >= 75) {
    return {
      label: 'Perlu perhatian',
      badgeClass:
        'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200',
      summary: `Penggunaan sudah ${Math.round(percentage)}% dari anggaran ${formatCurrency(planned, 'IDR')}.`,
      insight: `Sisa dana ${formatCurrency(remaining, 'IDR')} — tetap waspada agar tidak overspend.`,
      icon: AlertTriangle,
      tone: 'caution',
    };
  }

  return {
    label: 'On track',
    badgeClass:
      'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200',
    summary: 'Penggunaan anggaran masih aman dan sesuai rencana.',
    insight: `Masih tersedia ${formatCurrency(remaining, 'IDR')} untuk kebutuhan periode ini.`,
    icon: CheckCircle2,
    tone: 'ok',
  };
}

function getProgressColorClass(percentage: number): string {
  if (percentage <= 74) return 'bg-brand';
  if (percentage <= 89) return 'bg-amber-400';
  if (percentage <= 100) return 'bg-orange-500';
  return 'bg-rose-500';
}

function getPeriodLabel(period: string | null | undefined): string {
  if (!period) return '-';

  try {
    const normalized = period.slice(0, 7);
    return MONTH_FORMATTER.format(new Date(`${normalized}-01T00:00:00Z`));
  } catch (error) {
    return period.slice(0, 7);
  }
}

export default function BudgetCard({
  row,
  highlighted,
  disableHighlight,
  onToggleCarryover,
  onViewTransactions,
  onToggleHighlight,
  onEdit,
  onDelete,
}: BudgetCardProps) {
  const planned = Number(row.amount_planned ?? 0);
  const spent = Number(row.spent ?? 0);
  const remaining = Number(row.remaining ?? 0);
  const rawPercentage = Math.max(0, getProgressPercentage(planned, spent));
  const displayPercentage = Math.round(Math.min(100, rawPercentage));
  const status = getStatusMeta(rawPercentage, remaining, planned);
  const progressColorClass = getProgressColorClass(rawPercentage);

  const categoryName = row.category?.name?.trim() || 'Tanpa kategori';
  const categoryInitial = categoryName.charAt(0).toUpperCase();
  const categoryType = row.category?.type;
  const periodLabel = getPeriodLabel(row.period_month);

  const typeChip = categoryType === 'income'
    ? {
        label: 'Pemasukan',
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      }
    : categoryType === 'expense'
      ? {
          label: 'Pengeluaran',
          className: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
        }
      : {
          label: 'Umum',
          className: 'bg-muted/10 text-muted-foreground',
        };

  const StatusIcon = status.icon;

  return (
    <article
      className={clsx(
        'relative grid min-h-[280px] grid-rows-[auto,auto,1fr,auto] gap-3 rounded-2xl border border-white/10 bg-surface/60 p-4 shadow-sm backdrop-blur transition-colors md:min-h-[300px] md:p-5 xl:p-6',
        highlighted &&
          'border-brand/60 bg-gradient-to-br from-brand/10 via-surface/60 to-surface/80 shadow-[0_30px_60px_-35px_rgba(59,130,246,0.45)]',
      )}
      data-highlighted={highlighted || undefined}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-sm font-semibold uppercase text-brand shadow-inner">
            {categoryInitial}
          </div>
          <div className="min-w-0 space-y-2">
            <h3 className="text-base font-semibold leading-tight tracking-tight text-foreground line-clamp-1 break-words md:text-lg md:line-clamp-2">
              {categoryName}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className={clsx('inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide', typeChip.className)}>
                {typeChip.label}
              </span>
              <span className={clsx('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur', status.badgeClass)}>
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </span>
              {highlighted ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-brand shadow-sm ring-1 ring-brand/40">
                  <Sparkles className="h-3.5 w-3.5" /> Highlight
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground md:text-sm">
          <p className="line-clamp-1 break-words md:line-clamp-2">Periode {periodLabel}</p>
          <p className="line-clamp-2 break-words md:line-clamp-2">{status.summary}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-inner md:text-sm">
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Carryover</span>
          <span className="sm:hidden">CO</span>
          <span className="font-semibold text-foreground">{row.carryover_enabled ? 'Aktif' : 'Nonaktif'}</span>
          <label className="relative inline-flex h-5 w-10 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={row.carryover_enabled}
              onChange={(event) => onToggleCarryover(event.target.checked)}
              className="peer sr-only"
              aria-label={`Atur carryover untuk ${categoryName}`}
            />
            <span className="absolute inset-0 rounded-full bg-muted/20 transition peer-checked:bg-emerald-500/70" />
            <span className="relative ml-[3px] h-3.5 w-3.5 rounded-full bg-background shadow transition peer-checked:translate-x-5 dark:bg-zinc-900" />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:text-sm">Dialokasikan</p>
            <p className="text-lg font-bold text-foreground tabular-nums whitespace-nowrap truncate md:text-xl">
              {formatCurrency(planned, 'IDR')}
            </p>
            <p className="text-xs text-muted-foreground md:text-sm">Anggaran bulan ini</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:text-sm">Terpakai</p>
            <p className="text-lg font-bold text-foreground tabular-nums whitespace-nowrap truncate md:text-xl">
              {formatCurrency(spent, 'IDR')}
            </p>
            <p className="text-xs text-muted-foreground md:text-sm">
              {planned > 0 ? `${displayPercentage}% dari anggaran` : 'Tanpa batasan'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:text-sm">Sisa</p>
            <p
              className={clsx(
                'text-lg font-bold tabular-nums whitespace-nowrap truncate md:text-xl',
                remaining < 0
                  ? 'text-rose-500 dark:text-rose-300'
                  : 'text-emerald-600 dark:text-emerald-300',
              )}
            >
              {formatCurrency(remaining, 'IDR')}
            </p>
            <p className="text-xs text-muted-foreground md:text-sm">
              {remaining < 0 ? 'Perlu tindakan segera' : 'Masih tersedia'}
            </p>
          </div>
        </div>

        <div className="w-full space-y-2 lg:max-w-[240px]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Progress</span>
            <span className="tabular-nums">{displayPercentage}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
            <div
              className={clsx('h-full rounded-full transition-all duration-500 ease-out', progressColorClass)}
              style={{ width: `${Math.min(displayPercentage, 100)}%` }}
            />
          </div>
          <p
            className={clsx(
              'text-xs leading-snug md:text-sm',
              status.tone === 'danger'
                ? 'text-rose-500 dark:text-rose-300'
                : status.tone === 'warning'
                  ? 'text-orange-500 dark:text-orange-300'
                  : status.tone === 'caution'
                    ? 'text-amber-600 dark:text-amber-200'
                    : 'text-muted-foreground',
            )}
          >
            {status.insight}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onViewTransactions}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/70 text-muted-foreground transition hover:-translate-y-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-label={`Lihat transaksi untuk ${categoryName}`}
        >
          <Eye className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleHighlight}
          aria-pressed={highlighted}
          disabled={disableHighlight}
          aria-label={`${highlighted ? 'Hapus' : 'Tambah'} highlight untuk ${categoryName}`}
          className={clsx(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            highlighted
              ? 'border-brand/40 bg-brand/10 text-brand'
              : 'border-white/10 bg-surface/70 text-muted-foreground hover:-translate-y-0.5 hover:text-foreground',
            disableHighlight && !highlighted && 'cursor-not-allowed opacity-60 hover:translate-y-0',
          )}
        >
          <Star className="h-4 w-4" fill={highlighted ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface/70 text-muted-foreground transition hover:-translate-y-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          aria-label={`Edit ${categoryName}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 transition hover:-translate-y-0.5 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
          aria-label={`Hapus ${categoryName}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
