import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Eye, Flame, Pencil, Star, Trash2 } from 'lucide-react';
import type { BudgetWithSpent } from '../../../lib/budgetApi';
import { formatMoney } from '../../../lib/format';

function formatCurrency(value: number) {
  return formatMoney(Number.isFinite(value) ? value : 0, 'IDR');
}

function getStatus(remaining: number, progress: number) {
  if (remaining < 0) return { label: 'Melebihi Batas', icon: Flame, className: 'text-rose-300 bg-rose-500/10 border-rose-500/30' };
  if (progress >= 90) return { label: 'Warning', icon: AlertTriangle, className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' };
  return { label: 'Sehat', icon: CheckCircle2, className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
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
  const rawProgress = planned > 0 ? (spent / planned) * 100 : 0;
  const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
  const status = getStatus(remaining, progress);
  const StatusIcon = status.icon;
  const categories = budget.categories?.length ? budget.categories : budget.category ? [budget.category] : [];
  const shown = categories.slice(0, 2);
  const extra = Math.max(0, categories.length - shown.length);

  return (
    <article className={clsx('group rounded-3xl border border-white/10 bg-[#11141b] p-5 shadow-[0_10px_40px_-25px_rgba(0,0,0,0.8)] transition hover:border-white/20', isHighlighted && 'border-brand/40 bg-gradient-to-br from-brand/10 to-[#11141b]')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Periode {budget.period_month?.slice(0, 7)}</p>
          <h3 className="mt-1 truncate text-lg font-semibold text-zinc-100">{categories[0]?.name ?? 'Tanpa kategori'}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {shown.map((cat) => (
              <span key={cat.id} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300">{cat.name}</span>
            ))}
            {extra > 0 ? <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400">+{extra}</span> : null}
          </div>
        </div>
        <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium', status.className)}><StatusIcon className="h-3.5 w-3.5" />{status.label}</span>
      </div>

      <div className="mt-5 space-y-1">
        <p className={clsx('text-3xl font-semibold tracking-tight', remaining < 0 ? 'text-rose-300' : 'text-zinc-100')}>{formatCurrency(remaining)}</p>
        <p className="text-xs text-zinc-500">Sisa budget</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-zinc-500">Dialokasikan</p>
          <p className="mt-1 font-semibold text-zinc-200">{formatCurrency(planned)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-zinc-500">Terpakai</p>
          <p className="mt-1 font-semibold text-zinc-200">{formatCurrency(spent)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-500"><span>Progress</span><span>{progress}%</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className={clsx('h-full rounded-full', progress > 100 ? 'bg-rose-500' : progress > 90 ? 'bg-amber-500' : 'bg-brand')} style={{ width: `${Math.min(100, progress)}%` }} /></div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
        <span className="text-xs text-zinc-400">Carryover</span>
        <label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
          <input type="checkbox" checked={Boolean(budget.carryover_enabled)} onChange={(event) => onToggleCarryover(event.target.checked)} className="peer sr-only" />
          <span className="absolute inset-0 rounded-full bg-zinc-700 transition peer-checked:bg-brand/70" />
          <span className="relative ml-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </label>
      </div>

      <footer className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onViewTransactions} className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-zinc-100"><Eye className="h-4 w-4" /></button>
        <button type="button" onClick={onToggleHighlight} className={clsx('rounded-xl border p-2', isHighlighted ? 'border-brand/40 text-brand bg-brand/10' : 'border-white/10 text-zinc-400 hover:text-zinc-100')}><Star className="h-4 w-4" fill={isHighlighted ? 'currentColor' : 'none'} /></button>
        <button type="button" onClick={onEdit} className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-zinc-100"><Pencil className="h-4 w-4" /></button>
        <button type="button" onClick={onDelete} className="rounded-xl border border-rose-500/30 p-2 text-rose-300"><Trash2 className="h-4 w-4" /></button>
      </footer>
    </article>
  );
}
