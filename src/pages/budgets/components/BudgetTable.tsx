import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  NotebookPen,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/format';
import type { BudgetWithSpent } from '../../../lib/budgetApi';

interface BudgetTableProps {
  rows: BudgetWithSpent[];
  loading?: boolean;
  onEdit: (row: BudgetWithSpent) => void;
  onDelete: (row: BudgetWithSpent) => void;
  onToggleCarryover: (row: BudgetWithSpent, carryover: boolean) => void;
}

const CARD_WRAPPER_CLASS = 'grid gap-6 md:grid-cols-2 xl:grid-cols-3';

const CARD_CLASS =
  'group relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-gradient-to-br from-white via-white/95 to-zinc-50 shadow-lg ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-2xl dark:border-zinc-800/60 dark:from-zinc-950 dark:via-zinc-900/60 dark:to-zinc-900/30 dark:ring-white/5';

function LoadingCards() {
  return (
    <div className={clsx(CARD_WRAPPER_CLASS)}>
      {Array.from({ length: 6 }).map((_, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={index} className={clsx(CARD_CLASS, 'animate-pulse')}>
          <div className="relative flex h-full flex-col gap-5 p-6">
            <div className="h-10 w-3/4 rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/60" />
            <div className="h-6 w-1/2 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/60" />
            <div className="h-3 w-full rounded-full bg-zinc-200/70 dark:bg-zinc-800/60" />
            <div className="h-3 w-3/4 rounded-full bg-zinc-200/70 dark:bg-zinc-800/60" />
            <div className="mt-auto grid grid-cols-3 gap-3">
              <div className="h-12 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
              <div className="h-12 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
              <div className="h-12 rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-zinc-200/70 bg-white/70 p-12 text-center text-sm text-zinc-500 shadow-sm dark:border-zinc-700/70 dark:bg-zinc-900/40 dark:text-zinc-400">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand dark:bg-brand/20">
        <NotebookPen className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">Belum ada anggaran</h3>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Buat kategori anggaran untuk membantu kamu mengatur prioritas pengeluaran dan mencapai tujuan finansial.
        </p>
      </div>
    </div>
  );
}

const STATUS_PRESET = {
  over: {
    label: 'Melebihi batas',
    description: 'Pengeluaran melampaui rencana. Cek kembali prioritasmu.',
    icon: Flame,
    chipClass:
      'bg-rose-50 text-rose-600 ring-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
    iconBadge: 'bg-rose-500/10 text-rose-500 dark:bg-rose-400/10 dark:text-rose-300',
    gradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
  },
  warning: {
    label: 'Hampir habis',
    description: 'Pengeluaran mendekati batas. Jaga ritme pengeluaranmu.',
    icon: AlertTriangle,
    chipClass:
      'bg-amber-50 text-amber-600 ring-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    iconBadge: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300',
    gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
  },
  safe: {
    label: 'Sehat',
    description: 'Pengeluaran masih sesuai dengan rencana.',
    icon: CheckCircle2,
    chipClass:
      'bg-emerald-50 text-emerald-600 ring-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    iconBadge: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300',
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
  },
} as const;

type StatusKey = keyof typeof STATUS_PRESET;

export default function BudgetTable({ rows, loading, onEdit, onDelete, onToggleCarryover }: BudgetTableProps) {
  if (loading) {
    return <LoadingCards />;
  }

  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={CARD_WRAPPER_CLASS}>
      {rows.map((row) => {
        const planned = Number(row.amount_planned ?? 0);
        const spent = Number(row.spent ?? 0);
        const remaining = Number(row.remaining ?? 0);
        const percentage = planned > 0 ? Math.min(200, Math.round((spent / planned) * 100)) : spent > 0 ? 200 : 0;
        const displayPercentage = Math.min(100, percentage);
        const overBudget = remaining < 0;
        const status: StatusKey = overBudget ? 'over' : percentage >= 90 ? 'warning' : 'safe';
        const statusPreset = STATUS_PRESET[status];
        const categoryName = row.category?.name ?? 'Tanpa kategori';
        const categoryInitial = categoryName.trim().charAt(0).toUpperCase() || 'B';
        const StatusIcon = statusPreset.icon;

        return (
          <article key={row.id} className={CARD_CLASS}>
            <div className={`absolute inset-0 ${statusPreset.gradient}`} />
            <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/50 blur-3xl dark:bg-white/10" />
            <div className="absolute -bottom-8 -left-6 h-32 w-32 rounded-full bg-brand/5 blur-3xl dark:bg-brand/20" />

            <div className="relative flex h-full flex-col gap-6 p-6">
              <header className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={clsx('flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-lg font-semibold uppercase shadow-inner backdrop-blur', statusPreset.iconBadge)}>
                      {categoryInitial}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{categoryName}</h3>
                        <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium shadow-sm ring-1 ring-inset', statusPreset.chipClass)}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusPreset.label}
                        </span>
                      </div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Anggaran periode {row.period_month?.slice(0, 7) ?? '-'}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{statusPreset.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-white/50 bg-white/80 px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-200">
                      <span className="hidden text-xs sm:inline">Carryover</span>
                      <span className="sm:hidden">CO</span>
                      <span className="text-[0.7rem] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {row.carryover_enabled ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <label className="relative inline-flex h-6 w-12 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={row.carryover_enabled}
                          onChange={(event) => onToggleCarryover(row, event.target.checked)}
                          className="peer sr-only"
                          aria-label={`Atur carryover untuk ${categoryName}`}
                        />
                        <span className="absolute inset-0 rounded-full bg-zinc-200/80 transition peer-checked:bg-emerald-500/80 dark:bg-zinc-700/70 dark:peer-checked:bg-emerald-500/60" />
                        <span className="relative ml-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6" />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/90 text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200"
                      aria-label={`Edit ${categoryName}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200/60 bg-rose-50/80 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                      aria-label={`Hapus ${categoryName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </header>

              <section className="rounded-2xl border border-white/60 bg-white/80 p-5 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-300">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Anggaran</span>
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{formatCurrency(planned, 'IDR')}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Terpakai</span>
                    <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">{formatCurrency(spent, 'IDR')}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sisa</span>
                    <p
                      className={clsx(
                        'text-lg font-semibold',
                        remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400',
                      )}
                    >
                      {formatCurrency(remaining, 'IDR')}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <span>Progres penggunaan</span>
                    <span>{displayPercentage}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800/70">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        overBudget
                          ? 'bg-gradient-to-r from-rose-500 via-rose-500 to-rose-600'
                          : 'bg-gradient-to-r from-brand via-brand/90 to-brand/60',
                      )}
                      style={{ width: `${displayPercentage}%` }}
                    />
                  </div>
                  {percentage > 100 ? (
                    <p className="text-xs font-medium text-rose-500 dark:text-rose-400">
                      Pengeluaran sudah melebihi anggaran sebesar {formatCurrency(Math.abs(remaining), 'IDR')}.
                    </p>
                  ) : null}
                </div>
              </section>

              <footer className="rounded-2xl border border-dashed border-zinc-200/70 bg-white/70 p-5 text-sm text-zinc-600 shadow-sm backdrop-blur dark:border-zinc-700/70 dark:bg-zinc-900/40 dark:text-zinc-300">
                <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Catatan</p>
                <p className="mt-2 leading-relaxed">
                  {row.notes?.trim() ? row.notes : 'Tidak ada catatan. Tambahkan insight singkat agar keputusan berikutnya lebih mudah.'}
                </p>
              </footer>
            </div>
          </article>
        );
      })}
    </div>
  );
}
