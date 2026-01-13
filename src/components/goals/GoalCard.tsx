import { CalendarDays, Flag, Pencil, PiggyBank, Archive, Trash2, ListPlus } from 'lucide-react';
import type { GoalRecord } from '../../lib/api-goals';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.max(0, value));
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
  active: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  paused: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  achieved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  archived: 'bg-zinc-500/15 text-muted',
};

const PRIORITY_LABELS: Record<GoalRecord['priority'], string> = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Mendesak',
};

const PRIORITY_CLASSES: Record<GoalRecord['priority'], string> = {
  low: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  normal: 'bg-brand/15 text-brand',
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  urgent: 'bg-rose-500/15 text-rose-500 dark:text-rose-300',
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
      className={`flex min-w-0 flex-col gap-4 rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm transition hover:border-border md:p-5 ${
        className ?? ''
      }`}
    >
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-base font-semibold"
            style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}
            aria-hidden="true"
          >
            {iconLabel}
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-lg font-semibold text-text" title={goal.title}>
              {goal.title}
            </h3>
            {goal.description ? (
              <p className="line-clamp-2 text-sm text-muted">{goal.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              STATUS_CLASSES[goal.status]
            }`}
          >
            {STATUS_LABELS[goal.status]}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              PRIORITY_CLASSES[goal.priority]
            }`}
          >
            {PRIORITY_LABELS[goal.priority]}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,240px),1fr] lg:items-center">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Progress</span>
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-border/60">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand/60 via-brand to-brand"
              style={{ width: `${progress}%` }}
            />
            {milestoneDots.map((dot) => (
              <span
                key={dot.id}
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white bg-card shadow-sm"
                style={{ left: `${dot.percent}%`, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{formatCurrency(goal.saved_amount)} terkumpul</span>
            <span>{formatCurrency(goal.target_amount)} target</span>
          </div>
          {nextMilestone ? (
            <div className="rounded-xl bg-surface-2/70 px-3 py-1 text-xs font-semibold text-muted">
              Next milestone {formatCurrency(nextMilestone.amount)}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm text-text sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Target</dt>
              <dd className="font-medium">{formatCurrency(goal.target_amount)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Terkumpul</dt>
              <dd className="font-medium text-emerald-500 dark:text-emerald-300">
                {formatCurrency(goal.saved_amount)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Sisa</dt>
              <dd className="font-medium text-sky-500 dark:text-sky-300">
                {formatCurrency(remaining)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Deadline</dt>
              <dd className="flex items-center gap-1 text-sm">
                <CalendarDays className="h-4 w-4 text-muted" aria-hidden="true" />
                {goal.due_date ? dateFormatter.format(new Date(goal.due_date)) : '—'}
              </dd>
              {overdue ? (
                <span className="inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-500">
                  Lewat jatuh tempo
                </span>
              ) : null}
            </div>
          </dl>

          {dailySuggestion != null ? (
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1 rounded-xl bg-brand/10 px-3 py-1 font-medium text-brand">
                <Flag className="h-4 w-4" aria-hidden="true" />
                {formatCurrency(dailySuggestion)} / hari
              </span>
              {weeklySuggestion ? (
                <span className="inline-flex items-center gap-1 rounded-xl bg-brand/10 px-3 py-1 font-medium text-brand">
                  <PiggyBank className="h-4 w-4" aria-hidden="true" />
                  {formatCurrency(weeklySuggestion)} / minggu
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-xl bg-surface-2/70 px-3 py-1 font-medium text-muted">
                Rata-rata saat ini: {formatCurrency(averagePerDay)} / hari
              </span>
            </div>
          ) : null}
          {onQuickAdd && goal.status === 'active' ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
              <span className="text-[11px] uppercase tracking-wide text-muted">Tambah cepat</span>
              {quickAddOptions.map((amount) => {
                const key = `${goal.id}-${amount}`;
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => onQuickAdd(goal, amount)}
                    disabled={quickAddLoadingKey === key}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-1 px-3 py-1 text-xs font-semibold text-text transition hover:bg-border/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PiggyBank className="h-3 w-3" aria-hidden="true" />
                    {formatCurrency(amount)}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={() => onEdit(goal)}
          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-xl border border-border bg-surface-1 px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onOpenEntries(goal)}
          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <ListPlus className="h-4 w-4" aria-hidden="true" />
          Setoran & Riwayat
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(goal)}
          disabled={Boolean(archiveLoading)}
          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-xl border border-border bg-surface-1 px-4 text-sm font-medium text-text transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          {archiveLabel}
        </button>
        <button
          type="button"
          onClick={() => onDelete(goal)}
          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-xl bg-danger px-4 text-sm font-semibold text-white shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Hapus
        </button>
      </footer>
    </article>
  );
}
