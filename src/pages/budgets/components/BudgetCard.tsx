import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Flame,
  NotebookPen,
  Pencil,
  RefreshCcw,
  Star,
  Trash2,
} from 'lucide-react';
import type { BudgetWithSpent } from '../../../lib/budgetApi';
import { formatMoney } from '../../../lib/format';

function formatCurrency(value: number) {
  return formatMoney(Number.isFinite(value) ? value : 0, 'IDR');
}

function getStatus(remaining: number, progress: number) {
  if (remaining < 0) {
    return { label: 'Melebihi batas', icon: Flame, tone: 'text-rose-300 bg-rose-500/10 ring-rose-500/30' } as const;
  }
  if (progress >= 90) {
    return { label: 'Hampir habis', icon: AlertTriangle, tone: 'text-amber-300 bg-amber-500/10 ring-amber-500/30' } as const;
  }
  return { label: 'Sehat', icon: CheckCircle2, tone: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/30' } as const;
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
  const carryoverEnabled = Boolean(budget.carryover_enabled);
  const categories = budget.categories?.length
    ? budget.categories
    : budget.category
    ? [budget.category]
    : [{ id: 'unknown', name: 'Tanpa kategori', type: 'expense' as const }];
  const budgetTitle = budget.name?.trim() || categories[0]?.name || 'Tanpa nama budget';
  const extra = categories.length - 2;

  return (
    <article
      className={clsx(
        'group rounded-3xl border border-white/10 bg-[#0f1525]/90 p-5 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.8)] transition hover:border-white/15 hover:bg-[#121a2d]/95',
        isHighlighted && 'ring-1 ring-brand/45 border-brand/40',
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h3 className="truncate text-lg font-semibold text-white">{budgetTitle}</h3>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 2).map((category) => (
              <span key={category.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                {category.name}
              </span>
            ))}
            {extra > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-400">+{extra}</span>
            ) : null}
            <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1', status.tone)}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{budget.period_month?.slice(0, 7)}</span>
      </header>

      <div className="mt-5 space-y-2">
        <p className={clsx('text-3xl font-bold tabular-nums', remaining < 0 ? 'text-rose-300' : 'text-white')}>
          {formatCurrency(remaining)}
        </p>
        <p className="text-xs text-slate-400">Sisa anggaran</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-slate-400">Dialokasikan</p>
          <p className="mt-1 font-semibold text-slate-200">{formatCurrency(planned)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-slate-400">Terpakai</p>
          <p className="mt-1 font-semibold text-slate-200">{formatCurrency(spent)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Progress</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={clsx('h-full rounded-full transition-[width]', rawProgress > 100 ? 'bg-rose-400' : 'bg-brand')} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2"><RefreshCcw className="h-3.5 w-3.5" />Carryover</span>
        <label className="relative inline-flex h-6 w-11 cursor-pointer items-center" aria-label={`Atur carryover untuk ${budgetTitle}`}>
          <input type="checkbox" checked={carryoverEnabled} onChange={(event) => onToggleCarryover(event.target.checked)} className="peer sr-only" />
          <span className="absolute inset-0 rounded-full bg-white/10 transition peer-checked:bg-brand/60" />
          <span className="relative ml-[3px] h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </label>
      </div>

      {budget.notes?.trim() ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-400"><NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0" />{budget.notes.trim()}</p>
      ) : null}

      <footer className="mt-5 flex items-center justify-end gap-1.5">
        {[{ onClick: onViewTransactions, icon: Eye, label: 'Lihat transaksi' }, { onClick: onToggleHighlight, icon: Star, label: 'Highlight' }, { onClick: onEdit, icon: Pencil, label: 'Edit' }].map((item) => (
          <button key={item.label} type="button" onClick={item.onClick} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:text-white" aria-label={item.label}>
            <item.icon className="h-4 w-4" fill={item.label === 'Highlight' && isHighlighted ? 'currentColor' : 'none'} />
          </button>
        ))}
        <button type="button" onClick={onDelete} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 transition hover:text-rose-200" aria-label="Hapus">
          <Trash2 className="h-4 w-4" />
        </button>
      </footer>
    </article>
  );
}
