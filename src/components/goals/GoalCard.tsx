import { Archive, CalendarDays, Flag, ListPlus, Pencil, PiggyBank, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
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
  return Math.ceil((due.getTime() - Date.now()) / 86400000);
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
  if (totalDays <= 0) return Math.ceil(remaining);

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
  return goal.milestones.map((item, index) => ({
    percent: Math.max(0, Math.min(100, (item.amount / goal.target_amount) * 100)),
    id: `${goal.id}-milestone-${index}`,
  }));
}

const STATUS_LABELS: Record<GoalRecord['status'], string> = {
  active: 'Aktif',
  paused: 'Ditahan',
  achieved: 'Tercapai',
  archived: 'Diarsipkan',
};

const STATUS_CLASSES: Record<GoalRecord['status'], string> = {
  active: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  paused: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  achieved: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  archived: 'border-border/60 bg-surface-2/70 text-muted',
};

const PRIORITY_LABELS: Record<GoalRecord['priority'], string> = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Mendesak',
};

const PRIORITY_CLASSES: Record<GoalRecord['priority'], string> = {
  low: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  normal: 'border-brand/30 bg-brand/10 text-brand',
  high: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  urgent: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
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
        'group flex min-w-0 flex-col gap-5 rounded-3xl border border-border/70 bg-card/95 p-5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)] transition-all',
        'hover:-translate-y-0.5 hover:border-border hover:shadow-[0_18px_35px_-20px_rgba(0,0,0,0.7)]',
        'focus-within:ring-1 focus-within:ring-brand/50 md:gap-6 md:p-6',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 text-sm font-semibold"
            style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}
            aria-hidden="true"
          >
            {iconLabel}
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-base font-semibold text-text md:text-lg" title={goal.title}>
              {goal.title}
            </h3>
            {goal.description ? <p className="line-clamp-2 text-sm text-muted">{goal.description}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide', STATUS_CLASSES[goal.status])}>
            {STATUS_LABELS[goal.status]}
          </span>
          <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide', PRIORITY_CLASSES[goal.priority])}>
            {PRIORITY_LABELS[goal.priority]}
          </span>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Terkumpul</p>
            <p className="hw-money text-xl font-semibold text-text md:text-2xl">{formatCurrency(goal.saved_amount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Sisa</p>
            <p className="hw-money text-base font-medium text-sky-300">{formatCurrency(remaining)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.16em] text-muted">Progress</span>
            <span className="rounded-full border border-brand/35 bg-brand/10 px-2.5 py-1 font-semibold text-brand">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="relative h-1.5 w-full rounded-full bg-surface-2/90">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-brand/70 via-brand to-brand"
              style={{ width: `${progress}%` }}
            />
            {milestoneDots.map((dot) => (
              <span
                key={dot.id}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-card bg-muted/80"
                style={{ left: `${dot.percent}%`, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
          {nextMilestone ? (
            <p className="text-xs text-muted">
              Next milestone <span className="hw-money font-semibold text-text">{formatCurrency(nextMilestone.amount)}</span>
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5 text-sm md:grid-cols-4">
        <InfoBlock label="Target" value={<span className="hw-money">{formatCurrency(goal.target_amount)}</span>} />
        <InfoBlock
          label="Terkumpul"
          value={<span className="hw-money text-emerald-300">{formatCurrency(goal.saved_amount)}</span>}
        />
        <InfoBlock label="Sisa" value={<span className="hw-money text-sky-300">{formatCurrency(remaining)}</span>} />
        <InfoBlock
          label="Deadline"
          value={
            <span className="inline-flex items-center gap-1.5 text-text">
              <CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {goal.due_date ? dateFormatter.format(new Date(goal.due_date)) : '—'}
            </span>
          }
          extra={
            overdue ? (
              <span className="inline-flex items-center rounded-full border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                Lewat tempo
              </span>
            ) : null
          }
        />
      </section>

      <section className="space-y-2.5">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Saving pace</p>
        <div className="grid gap-2 md:grid-cols-3">
          <MetricPill
            icon={<Flag className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Kebutuhan / hari"
            value={dailySuggestion != null ? formatCurrency(dailySuggestion) : '—'}
          />
          <MetricPill
            icon={<PiggyBank className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Kebutuhan / minggu"
            value={weeklySuggestion != null ? formatCurrency(weeklySuggestion) : '—'}
          />
          <MetricPill label="Rata-rata saat ini / hari" value={formatCurrency(averagePerDay)} />
        </div>
      </section>

      {onQuickAdd && goal.status === 'active' ? (
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Tambah cepat</p>
          <div className="flex flex-wrap gap-2">
            {quickAddOptions.map((amount) => {
              const key = `${goal.id}-${amount}`;
              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => onQuickAdd(goal, amount)}
                  disabled={quickAddLoadingKey === key}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-surface-1 px-3 text-xs font-semibold text-text transition hover:border-brand/30 hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PiggyBank className="h-3 w-3" aria-hidden="true" />
                  <span className="hw-money">{formatCurrency(amount)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <footer className="grid grid-cols-2 gap-2 pt-1 md:flex md:flex-wrap md:justify-end">
        <button
          type="button"
          onClick={() => onEdit(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-surface-1 px-3 text-xs font-medium text-text transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] md:text-sm"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onOpenEntries(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-semibold text-brand-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] md:text-sm"
        >
          <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Setoran & Riwayat
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(goal)}
          disabled={Boolean(archiveLoading)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-surface-1 px-3 text-xs font-medium text-text transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
        >
          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          {archiveLabel}
        </button>
        <button
          type="button"
          onClick={() => onDelete(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] md:text-sm"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Hapus
        </button>
      </footer>
    </article>
  );
}

function InfoBlock({
  label,
  value,
  extra,
}: {
  label: string;
  value: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-1/60 p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
      {extra ? <div className="mt-1.5">{extra}</div> : null}
    </div>
  );
}

function MetricPill({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface-1/70 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-muted">{icon}{label}</p>
      <p className="hw-money mt-1 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}
