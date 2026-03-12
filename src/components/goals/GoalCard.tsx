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
      className={`flex min-w-0 flex-col gap-5 rounded-3xl border border-border/60 bg-surface-1/90 p-4 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.8)] transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_16px_40px_-20px_rgba(0,0,0,0.85)] md:p-5 ${
        className ?? ''
      }`}
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-semibold shadow-inner"
            style={{ backgroundColor: `${goal.color}1f`, color: goal.color }}
            aria-hidden="true"
          >
            {iconLabel}
          </div>
          <div className="min-w-0 space-y-1.5">
            <h3 className="truncate text-base font-semibold tracking-tight text-text md:text-lg" title={goal.title}>
              {goal.title}
            </h3>
            {goal.description ? <p className="line-clamp-2 text-xs leading-relaxed text-muted md:text-sm">{goal.description}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <span
            className={`inline-flex items-center rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              STATUS_CLASSES[goal.status]
            }`}
          >
            {STATUS_LABELS[goal.status]}
          </span>
          <span
            className={`inline-flex items-center rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              PRIORITY_CLASSES[goal.priority]
            }`}
          >
            {PRIORITY_LABELS[goal.priority]}
          </span>
        </div>
      </header>

      <div className="space-y-4">
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Progress</span>
            <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="relative h-1.5 w-full rounded-full bg-border/70">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-brand/70 via-brand to-brand transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
            {milestoneDots.map((dot) => (
              <span
                key={dot.id}
                className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-white/80 bg-surface-1"
                style={{ left: `${dot.percent}%`, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 text-xs md:text-sm">
          <div className="rounded-2xl border border-white/10 bg-surface-2/55 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.13em] text-white/50">Terkumpul</p>
            <p className="mt-1 font-semibold text-emerald-300 hw-money">{formatCurrency(goal.saved_amount)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-surface-2/55 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.13em] text-white/50">Sisa</p>
            <p className="mt-1 font-semibold text-sky-300 hw-money">{formatCurrency(remaining)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-surface-2/55 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.13em] text-white/50">Target</p>
            <p className="mt-1 font-semibold text-text hw-money">{formatCurrency(goal.target_amount)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-surface-2/55 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.13em] text-white/50">Deadline</p>
            <p className="mt-1 flex items-center gap-1.5 font-medium text-text">
              <CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {goal.due_date ? dateFormatter.format(new Date(goal.due_date)) : '—'}
            </p>
            {overdue ? (
              <span className="mt-1 inline-flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                Lewat jatuh tempo
              </span>
            ) : null}
          </div>
        </section>

        <section className="grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-surface-2/45 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.13em] text-white/50">Next milestone</p>
            <p className="mt-1 text-sm font-medium text-text hw-money">
              {nextMilestone ? formatCurrency(nextMilestone.amount) : 'Semua tercapai'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-surface-2/45 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.13em] text-white/50">Estimasi / hari</p>
            <p className="mt-1 text-sm font-medium text-text hw-money">
              {dailySuggestion != null ? `${formatCurrency(dailySuggestion)} / hari` : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-surface-2/45 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.13em] text-white/50">Estimasi / minggu</p>
            <p className="mt-1 text-sm font-medium text-text hw-money">
              {weeklySuggestion != null ? `${formatCurrency(weeklySuggestion)} / minggu` : '—'}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-surface-2/35 px-3 py-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Flag className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            Rata-rata saat ini: <span className="font-medium text-text hw-money">{formatCurrency(averagePerDay)} / hari</span>
          </span>
          {daysLeft != null ? (
            <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium text-text">
              {daysLeft >= 0 ? `${daysLeft} hari lagi` : `${Math.abs(daysLeft)} hari lewat`}
            </span>
          ) : null}
        </div>

        {onQuickAdd && goal.status === 'active' ? (
          <div className="rounded-2xl border border-white/10 bg-surface-2/35 p-2.5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/50">
              <PiggyBank className="h-3.5 w-3.5" aria-hidden="true" />
              Tambah cepat
            </div>
            <div className="flex flex-wrap gap-2">
              {quickAddOptions.map((amount) => {
                const key = `${goal.id}-${amount}`;
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => onQuickAdd(goal, amount)}
                    disabled={quickAddLoadingKey === key}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-surface-1/90 px-3 py-1.5 text-xs font-semibold text-text transition hover:border-brand/40 hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PiggyBank className="h-3 w-3" aria-hidden="true" />
                    <span className="hw-money">{formatCurrency(amount)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => onEdit(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-surface-2/50 px-3 text-xs font-medium text-text transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onOpenEntries(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 text-xs font-semibold text-brand-foreground shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <ListPlus className="h-4 w-4" aria-hidden="true" />
          Setoran & Riwayat
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(goal)}
          disabled={Boolean(archiveLoading)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-surface-2/50 px-3 text-xs font-medium text-text transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          {archiveLabel}
        </button>
        <button
          type="button"
          onClick={() => onDelete(goal)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-danger/90 px-3 text-xs font-semibold text-white shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Hapus
        </button>
      </footer>
    </article>
  );
}
