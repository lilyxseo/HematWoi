import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Eye, Pencil, RefreshCcw, Star, Trash2, Flame } from 'lucide-react';
import type { BudgetWithSpent } from '../../../lib/budgetApi';
import { formatMoney } from '../../../lib/format';

function formatCurrency(value: number) {
  return formatMoney(Number.isFinite(value) ? value : 0, 'IDR');
}

function getStatus(remaining: number, progress: number) {
  if (remaining < 0) return { label: 'Melebihi batas', icon: Flame, tone: 'text-rose-300 bg-rose-500/10 border-rose-500/20' };
  if (progress >= 90) return { label: 'Warning', icon: AlertTriangle, tone: 'text-amber-200 bg-amber-500/10 border-amber-500/20' };
  return { label: 'Sehat', icon: CheckCircle2, tone: 'text-emerald-200 bg-emerald-500/10 border-emerald-500/20' };
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
  const remaining = Number.isFinite(Number(budget.remaining)) ? Number(budget.remaining) : planned - spent;
  const rawProgress = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 200 : 0;
  const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
  const status = getStatus(remaining, progress);
  const StatusIcon = status.icon;
  const categories = budget.categories?.length ? budget.categories : budget.category ? [budget.category] : [];
  const visibleCategories = categories.slice(0, 2);
  const hiddenCount = Math.max(0, categories.length - visibleCategories.length);

  return (
    <article
      className={clsx(
        'group rounded-3xl border border-white/10 bg-zinc-900/75 p-5 shadow-[0_20px_50px_-34px_rgba(0,0,0,0.85)] transition hover:border-white/20 hover:bg-zinc-900/90 md:p-6',
        isHighlighted && 'border-brand/50 shadow-[0_0_0_1px_rgba(99,102,241,.3),0_30px_70px_-42px_rgba(99,102,241,.65)]'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="truncate text-lg font-semibold text-zinc-100">{budget.category?.name ?? 'Budget kustom'}</p>
          <div className="flex flex-wrap items-center gap-2">
            {visibleCategories.map((category) => (
              <span key={category.id} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">
                {category.name}
              </span>
            ))}
            {hiddenCount > 0 ? <span className="text-xs text-zinc-400">+{hiddenCount} kategori</span> : null}
          </div>
        </div>
        <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs', status.tone)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Sisa budget</p>
        <p className={clsx('text-3xl font-semibold tracking-tight', remaining < 0 ? 'text-rose-300' : 'text-zinc-100')}>
          {formatCurrency(remaining)}
        </p>
        <p className="text-sm text-zinc-400">Periode {budget.period_month?.slice(0, 7) ?? '-'}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-zinc-500">Alokasi</p>
          <p className="mt-1 font-medium tabular-nums text-zinc-200">{formatCurrency(planned)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-zinc-500">Terpakai</p>
          <p className="mt-1 font-medium tabular-nums text-zinc-200">{formatCurrency(spent)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={clsx('h-full rounded-full transition-all',
              progress <= 74 ? 'bg-brand' : progress <= 100 ? 'bg-amber-400' : 'bg-rose-400')}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
        <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
          <RefreshCcw className="h-3.5 w-3.5" />
          Carryover
        </div>
        <label className="relative inline-flex h-6 w-11 cursor-pointer items-center" aria-label="Atur carryover">
          <input
            type="checkbox"
            checked={Boolean(budget.carryover_enabled)}
            onChange={(event) => onToggleCarryover(event.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-zinc-700 transition peer-checked:bg-emerald-500/80" />
          <span className="relative ml-[3px] h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </label>
      </div>

      <footer className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onViewTransactions} className="h-9 w-9 rounded-xl border border-white/10 text-zinc-400 hover:text-zinc-100"><Eye className="mx-auto h-4 w-4" /></button>
        <button
          type="button"
          onClick={onToggleHighlight}
          className={clsx('h-9 w-9 rounded-xl border', isHighlighted ? 'border-brand/40 text-brand' : 'border-white/10 text-zinc-400 hover:text-zinc-100')}
        >
          <Star className="mx-auto h-4 w-4" fill={isHighlighted ? 'currentColor' : 'none'} />
        </button>
        <button type="button" onClick={onEdit} className="h-9 w-9 rounded-xl border border-white/10 text-zinc-400 hover:text-zinc-100"><Pencil className="mx-auto h-4 w-4" /></button>
        <button type="button" onClick={onDelete} className="h-9 w-9 rounded-xl border border-rose-500/30 text-rose-300 hover:text-rose-200"><Trash2 className="mx-auto h-4 w-4" /></button>
      </footer>
    </article>
  );
}
