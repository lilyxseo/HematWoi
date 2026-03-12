import clsx from 'clsx';
import { CalendarDays, Flag, Pencil, PiggyBank, Archive, Trash2, ListPlus } from 'lucide-react';
import type { GoalRecord } from '../../lib/api-goals';
import { formatMoney } from '../../lib/format';

const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

function formatCurrency(value: number) {
  return formatMoney(Math.max(0, value), 'IDR');
}

function calculateProgress(goal: GoalRecord) {
  const target = goal.target_amount || 0;
  const saved = goal.saved_amount || 0;
  const progress = target > 0 ? (saved / target) * 100 : 0;
  return Math.min(100, Math.max(0, progress));
}

function calculateDaysLeft(dueDate: string | null) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const diff = Math.ceil((due.getTime() - Date.now()) / 86400000);
  return diff;
}

function calculateDailySuggestion(goal: GoalRecord) {
  if (!goal.due_date) return null;
  const remaining = Math.max(goal.target_amount - goal.saved_amount, 0);
  if (remaining <= 0) return null;

  const due = new Date(goal.due_date);
  if (Number.isNaN(due.getTime())) return null;

  const start = goal.start_date ? new Date(goal.start_date) : null;
  if (!start || Number.isNaN(start.getTime())) {
    const daysLeft = calculateDaysLeft(goal.due_date);
    if (daysLeft == null) return null;
    return Math.ceil(remaining / Math.max(daysLeft, 1));
  }

  const totalDays = Math.floor((due.getTime() - start.getTime()) / 86400000) + 1;
  if (totalDays <= 0) {
    return Math.ceil(remaining);
  }

  return Math.ceil(remaining / Math.max(totalDays, 1));
}

function calculateAveragePerDay(goal: GoalRecord) {
  const start = goal.start_date ? new Date(goal.start_date) : null;
  if (!start || Number.isNaN(start.getTime())) return goal.saved_amount;
  const diff = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
  return goal.saved_amount / diff;
}

function computeMilestoneDots(goal: GoalRecord) {
  if (!goal.target_amount || goal.target_amount <= 0) return [] as { percent: number; id: string }[];
  return goal.milestones.map((item, index) => {
    const percent = Math.max(0, Math.min(100, (item.amount / goal.target_amount) * 100));
    return { percent, id: `${goal.id}-milestone-${index}` };
  });
}

const STATUS_LABELS: Record<GoalRecord['status'], string> = {
  active: 'Aktif',
  paused: 'Ditahan',
  achieved: 'Tercapai',
  archived: 'Diarsipkan',
};

const STATUS_CLASSES: Record<GoalRecord['status'], string> = {
  active: 'border-sky-400/25 bg-sky-500/15 text-sky-200',
  paused: 'border-amber-400/25 bg-amber-500/15 text-amber-200',
  achieved: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-200',
  archived: 'border-white/10 bg-white/5 text-muted',
};

const PRIORITY_LABELS: Record<GoalRecord['priority'], string> = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Mendesak',
};

const PRIORITY_CLASSES: Record<GoalRecord['priority'], string> = {
  low: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  normal: 'border-brand/30 bg-brand/10 text-brand',
  high: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
  urgent: 'border-rose-400/35 bg-rose-500/15 text-rose-200',
};

interface GoalCardProps {
  goal: GoalRecord;
  onEdit: (goal: GoalRecord) => void;
  onOpenEntries: (goal: GoalRecord) => void;
  onToggleArchive: (goal: GoalRecord) => void;
  onDelete: (goal: GoalRecord) => void;
  onQuickAdd?: (goal: GoalRecord, amount: number) => void;
  archiveLoading?: boolean;
  quickAddLoadingKey?: string | null;
  className?: string;
}

export default function GoalCard({
  goal,
  onEdit,
  onOpenEntries,
  onToggleArchive,
  onDelete,
  onQuickAdd,
  archiveLoading,
  quickAddLoadingKey,
  className,
}: GoalCardProps) {
  const progress = calculateProgress(goal);
  const remaining = Math.max(goal.target_amount - goal.saved_amount, 0);
  const daysLeft = calculateDaysLeft(goal.due_date);
  const dailySuggestion = calculateDailySuggestion(goal);
  const weeklySuggestion = dailySuggestion != null ? dailySuggestion * 7 : null;
  const averagePerDay = calculateAveragePerDay(goal);
  const overdue = goal.due_date ? daysLeft != null && daysLeft < 0 && goal.status !== 'achieved' : false;
  const milestoneDots = computeMilestoneDots(goal);

  const archiveLabel = goal.status === 'archived' ? 'Aktifkan' : 'Arsipkan';
  const iconLabel = goal.icon?.trim() || goal.title.charAt(0).toUpperCase() || '🎯';
  const sortedMilestones = [...goal.milestones].sort((a, b) => a.amount - b.amount);
  const nextMilestone = sortedMilestones.find((milestone) => milestone.amount > goal.saved_amount) ?? null;
  const quickAddOptions = [50000, 100000, 250000];

  return (
    <article
      className={clsx(
        'flex min-w-0 flex-col gap-5 rounded-3xl border border-white/10 bg-[#11141c]/95 p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] transition-all duration-300',
        'hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_22px_44px_-26px_rgba(0,0,0,0.95)]',
        className,
      )}
    >
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 text-sm font-semibold shadow-inner"
            style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}
            aria-hidden="true"
          >
            {iconLabel}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 className="truncate text-lg font-semibold leading-tight text-text" title={goal.title}>
              {goal.title}
            </h3>
            {goal.description ? <p className="line-clamp-2 text-sm leading-relaxed text-muted">{goal.description}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={clsx(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
              STATUS_CLASSES[goal.status],
            )}
          >
            {STATUS_LABELS[goal.status]}
          </span>
          <span
            className={clsx(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
              PRIORITY_CLASSES[goal.priority],
            )}
          >
            {PRIORITY_LABELS[goal.priority]}
          </span>
        </div>
      </header>

      <div className="space-y-4 rounded-2xl border border-white/5 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Progress</span>
          <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="relative h-1.5 w-full rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-brand/70 via-brand/90 to-cyan-300"
            style={{ width: `${progress}%` }}
          />
          {milestoneDots.map((dot) => (
            <span
              key={dot.id}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/70 bg-[#11141c]"
              style={{ left: `${dot.percent}%`, transform: 'translate(-50%, -50%)' }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-muted sm:grid-cols-4">
          <div className="space-y-1">
            <p className="uppercase tracking-wide text-white/45">Target</p>
            <p className="hw-money text-sm font-semibold text-text">{formatCurrency(goal.target_amount)}</p>
          </div>
          <div className="space-y-1">
            <p className="uppercase tracking-wide text-white/45">Terkumpul</p>
            <p className="hw-money text-sm font-semibold text-emerald-300">{formatCurrency(goal.saved_amount)}</p>
          </div>
          <div className="space-y-1">
            <p className="uppercase tracking-wide text-white/45">Sisa</p>
            <p className="hw-money text-sm font-semibold text-sky-300">{formatCurrency(remaining)}</p>
          </div>
          <div className="space-y-1">
            <p className="uppercase tracking-wide text-white/45">Deadline</p>
            <p className="flex items-center gap-1.5 text-sm font-medium text-text">
              <CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {goal.due_date ? dateFormatter.format(new Date(goal.due_date)) : '—'}
            </p>
          </div>
        </div>
        {overdue ? (
          <span className="inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-rose-200">
            Lewat jatuh tempo
          </span>
        ) : null}
        {nextMilestone ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-muted">
            Next milestone <span className="hw-money font-semibold text-text">{formatCurrency(nextMilestone.amount)}</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 text-xs md:grid-cols-3">
        {dailySuggestion != null ? (
          <>
            <div className="rounded-xl border border-brand/20 bg-brand/10 px-3 py-2.5 text-brand">
              <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-brand/80">
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                Per Hari
              </p>
              <p className="hw-money text-sm font-semibold">{formatCurrency(dailySuggestion)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-text">
              <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
                <PiggyBank className="h-3.5 w-3.5" aria-hidden="true" />
                Per Minggu
              </p>
              <p className="hw-money text-sm font-semibold">{formatCurrency(weeklySuggestion ?? 0)}</p>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-muted md:col-span-2">
            Tambahkan deadline untuk melihat estimasi kebutuhan tabungan harian dan mingguan.
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-text md:col-span-1">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">Rata-rata Saat Ini</p>
          <p className="hw-money text-sm font-semibold">{formatCurrency(averagePerDay)} / hari</p>
        </div>
      </div>

      {onQuickAdd && goal.status === 'active' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Tambah cepat</span>
          {quickAddOptions.map((amount) => {
            const key = `${goal.id}-${amount}`;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => onQuickAdd(goal, amount)}
                disabled={quickAddLoadingKey === key}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-text transition hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PiggyBank className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hw-money">{formatCurrency(amount)}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <footer className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onEdit(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.03] px-3 text-xs font-medium text-text transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onOpenEntries(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-semibold text-brand-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Setoran & Riwayat
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(goal)}
          disabled={Boolean(archiveLoading)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.03] px-3 text-xs font-medium text-text transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          {archiveLabel}
        </button>
        <button
          type="button"
          onClick={() => onDelete(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Hapus
        </button>
      </footer>
    </article>
  );
}
