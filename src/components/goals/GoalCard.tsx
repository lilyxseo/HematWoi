import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Archive, CalendarDays, Flag, ListPlus, Pencil, PiggyBank, Trash2 } from 'lucide-react';
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
  return Math.ceil(remaining / Math.max(totalDays, 1));
}

function calculateAveragePerDay(goal: GoalRecord) {
  const start = goal.start_date ? new Date(goal.start_date) : null;
  if (!start || Number.isNaN(start.getTime())) return goal.saved_amount;
  const elapsedDays = Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
  return goal.saved_amount / elapsedDays;
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
  active: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
  paused: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  achieved: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  archived: 'border-white/10 bg-white/5 text-muted',
};

const PRIORITY_LABELS: Record<GoalRecord['priority'], string> = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Mendesak',
};

const PRIORITY_CLASSES: Record<GoalRecord['priority'], string> = {
  low: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  normal: 'border-brand/40 bg-brand/10 text-brand',
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

interface CompactStatProps {
  label: string;
  value: string;
  valueClassName?: string;
  icon?: ReactNode;
  caption?: string;
}

function CompactStat({ label, value, valueClassName, icon, caption }: CompactStatProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className={clsx('mt-1.5 text-sm font-semibold text-text sm:text-base', valueClassName)}>
        <span className="inline-flex items-center gap-1.5 hw-money">
          {icon}
          {value}
        </span>
      </dd>
      {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
    </div>
  );
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
        'group flex min-w-0 flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-b from-surface-1/90 to-card/90 p-4 shadow-[0_12px_40px_-30px_rgba(0,0,0,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)] sm:p-5',
        className,
      )}
    >
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
              style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
              aria-hidden="true"
            >
              {iconLabel}
            </span>
            <h3 className="truncate text-base font-semibold tracking-tight text-text sm:text-lg" title={goal.title}>
              {goal.title}
            </h3>
          </div>
          {goal.description ? <p className="line-clamp-2 text-sm text-muted">{goal.description}</p> : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={clsx(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
              STATUS_CLASSES[goal.status],
            )}
          >
            {STATUS_LABELS[goal.status]}
          </span>
          <span
            className={clsx(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
              PRIORITY_CLASSES[goal.priority],
            )}
          >
            {PRIORITY_LABELS[goal.priority]}
          </span>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-black/10 p-3.5">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Progress</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-text">
              <span className="hw-money">{formatCurrency(goal.saved_amount)}</span>
              <span className="mx-1.5 text-sm text-muted">/</span>
              <span className="hw-money text-base text-muted">{formatCurrency(goal.target_amount)}</span>
            </p>
          </div>
          <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
            {Math.round(progress)}%
          </span>
        </div>

        <div className="relative h-1.5 w-full rounded-full bg-white/10">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-brand/60 via-brand to-brand"
            style={{ width: `${progress}%` }}
          />
          {milestoneDots.map((dot) => (
            <span
              key={dot.id}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-card bg-white/80"
              style={{ left: `${dot.percent}%`, transform: 'translate(-50%, -50%)' }}
            />
          ))}
        </div>

        {nextMilestone ? (
          <p className="text-xs text-muted">
            Next milestone: <span className="font-semibold text-text hw-money">{formatCurrency(nextMilestone.amount)}</span>
          </p>
        ) : (
          <p className="text-xs text-muted">Milestone berikutnya tidak tersedia.</p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <CompactStat label="Target" value={formatCurrency(goal.target_amount)} />
        <CompactStat label="Terkumpul" value={formatCurrency(goal.saved_amount)} valueClassName="text-emerald-300" />
        <CompactStat label="Sisa" value={formatCurrency(remaining)} valueClassName="text-sky-300" />
        <CompactStat
          label="Deadline"
          value={goal.due_date ? dateFormatter.format(new Date(goal.due_date)) : '—'}
          icon={<CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
          caption={overdue ? 'Lewat jatuh tempo' : undefined}
          valueClassName={overdue ? 'text-rose-300' : undefined}
        />
      </dl>

      <section className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-muted">
          <p className="mb-1 font-medium uppercase tracking-[0.12em] text-muted">Kebutuhan / Hari</p>
          <p className="font-semibold text-text hw-money">{dailySuggestion != null ? formatCurrency(dailySuggestion) : '—'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-muted">
          <p className="mb-1 font-medium uppercase tracking-[0.12em] text-muted">Kebutuhan / Minggu</p>
          <p className="font-semibold text-text hw-money">{weeklySuggestion != null ? formatCurrency(weeklySuggestion) : '—'}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-muted">
          <p className="mb-1 font-medium uppercase tracking-[0.12em] text-muted">Rata-rata Saat Ini</p>
          <p className="font-semibold text-text hw-money">{formatCurrency(averagePerDay)} / hari</p>
        </div>
      </section>

      {onQuickAdd && goal.status === 'active' ? (
        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/10 p-2.5">
          <span className="px-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Tambah cepat</span>
          {quickAddOptions.map((amount) => {
            const key = `${goal.id}-${amount}`;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => onQuickAdd(goal, amount)}
                disabled={quickAddLoadingKey === key}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 text-xs font-semibold text-text transition hover:border-brand/50 hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PiggyBank className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hw-money">{formatCurrency(amount)}</span>
              </button>
            );
          })}
        </section>
      ) : null}

      <footer className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onEdit(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.03] px-3 text-xs font-medium text-text transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onOpenEntries(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-semibold text-brand-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <ListPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Setoran & Riwayat
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(goal)}
          disabled={Boolean(archiveLoading)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.03] px-3 text-xs font-medium text-text transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" aria-hidden="true" />
          {archiveLabel}
        </button>
        <button
          type="button"
          onClick={() => onDelete(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Hapus
        </button>
      </footer>
    </article>
  );
}
