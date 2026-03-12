import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Eye, Flame, Pencil, Star, Trash2 } from 'lucide-react';
import type { BudgetWithSpent } from '../../../lib/budgetApi';
import { formatMoney } from '../../../lib/format';

function formatCurrency(value: number) {
  return formatMoney(Number.isFinite(value) ? value : 0, 'IDR');
}

function getStatus(remaining: number, progress: number) {
  if (remaining < 0) {
    return { label: 'Melebihi batas', icon: Flame, className: 'text-rose-300 bg-rose-500/10 border-rose-500/30' } as const;
  }
  if (progress >= 90) {
    return { label: 'Warning', icon: AlertTriangle, className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' } as const;
  }
  return { label: 'Sehat', icon: CheckCircle2, className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' } as const;
}

function getProgressTone(progress: number) {
  if (progress <= 74) return 'bg-emerald-400';
  if (progress <= 89) return 'bg-amber-400';
  if (progress <= 100) return 'bg-orange-400';
  return 'bg-rose-400';
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

export default function BudgetCard({ budget, isHighlighted, onViewTransactions, onToggleHighlight, onToggleCarryover, onEdit, onDelete }: BudgetCardProps) {
  const planned = Number(budget.amount_planned ?? 0);
  const spent = Number(budget.spent ?? 0);
  const remaining = Number.isFinite(Number(budget.remaining)) ? Number(budget.remaining) : planned - spent;
  const rawProgress = planned > 0 ? (spent / planned) * 100 : spent > 0 ? 200 : 0;
  const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
  const status = getStatus(remaining, progress);
  const StatusIcon = status.icon;
  const progressTone = getProgressTone(rawProgress);
  const categoryList = budget.categories?.length ? budget.categories : budget.category ? [budget.category] : [];
  const title = categoryList.length > 1 ? `${categoryList.length} kategori` : categoryList[0]?.name ?? 'Tanpa kategori';
  const visibleCategories = categoryList.slice(0, 2);
  const extraCategories = Math.max(0, categoryList.length - visibleCategories.length);

  return (
    <article
      className={clsx(
        'group relative rounded-3xl border border-white/10 bg-zinc-950/90 p-5 shadow-[0_20px_40px_-30px_rgba(0,0,0,0.9)] transition hover:border-white/20 hover:bg-zinc-950',
        isHighlighted ? 'border-brand/50 shadow-[0_24px_48px_-28px_rgba(59,130,246,0.5)]' : '',
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Budget</p>
          <h3 className="mt-1 truncate text-lg font-semibold text-zinc-50">{title}</h3>
          <p className="mt-1 text-xs text-zinc-400">Periode {budget.period_month?.slice(0, 7) ?? '-'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleCategories.map((category) => (
              <span key={category.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">
                {category.name}
              </span>
            ))}
            {extraCategories > 0 ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">+{extraCategories}</span> : null}
          </div>
        </div>

        <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs', status.className)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-xs text-zinc-400">Sisa Budget</p>
        <p className={clsx('mt-1 text-3xl font-semibold tracking-tight', remaining < 0 ? 'text-rose-300' : 'text-zinc-50')}>
          {formatCurrency(remaining)}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-zinc-400">Dialokasikan</p>
          <p className="mt-1 font-semibold text-zinc-100">{formatCurrency(planned)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs text-zinc-400">Terpakai</p>
          <p className="mt-1 font-semibold text-zinc-100">{formatCurrency(spent)}</p>
        </div>
      </div>

      <div className="mb-5 space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Progress penggunaan</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={clsx('h-full rounded-full', progressTone)} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
        <span className="text-xs uppercase tracking-[0.14em] text-zinc-400">Carryover</span>
        <label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={Boolean(budget.carryover_enabled)}
            onChange={(event) => onToggleCarryover(event.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-zinc-700 transition peer-checked:bg-emerald-500/60" />
          <span className="relative ml-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </label>
      </div>

      <footer className="flex items-center justify-end gap-2">
        {[
          { onClick: onViewTransactions, icon: Eye, label: 'Lihat transaksi' },
          { onClick: onToggleHighlight, icon: Star, label: 'Highlight', active: isHighlighted },
          { onClick: onEdit, icon: Pencil, label: 'Edit' },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={clsx(
              'inline-flex h-9 w-9 items-center justify-center rounded-xl border text-zinc-300 transition',
              action.active ? 'border-brand/40 bg-brand/15 text-brand' : 'border-white/10 bg-white/[0.02] hover:border-white/20',
            )}
            aria-label={action.label}
          >
            <action.icon className="h-4 w-4" />
          </button>
        ))}
        <button type="button" onClick={onDelete} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300" aria-label="Hapus">
          <Trash2 className="h-4 w-4" />
        </button>
      </footer>
    </article>
  );
}
