import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  Flame,
  NotebookPen,
  Pencil,
  RefreshCcw,
  Sparkles,
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

const CARD_WRAPPER_CLASS = 'grid gap-5 md:grid-cols-2 xl:grid-cols-3';

const CARD_CLASS =
  'relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-[0_28px_50px_-28px_rgba(15,23,42,0.5)] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_35px_70px_-35px_rgba(15,23,42,0.55)] backdrop-blur supports-[backdrop-filter]:bg-surface/60';

function LoadingCards() {
  return (
    <div className={clsx(CARD_WRAPPER_CLASS)}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className={clsx(CARD_CLASS, 'animate-pulse border-dashed')}
        >
          <div className="h-4 w-24 rounded-full bg-zinc-200/70 dark:bg-zinc-700/60" />
          <div className="space-y-3">
            <div className="h-3 w-3/4 rounded-full bg-zinc-200/70 dark:bg-zinc-700/60" />
            <div className="h-3 w-2/4 rounded-full bg-zinc-200/70 dark:bg-zinc-700/60" />
          </div>
          <div className="h-32 rounded-2xl bg-zinc-200/50 dark:bg-zinc-800/50" />
          <div className="h-20 rounded-2xl border border-dashed border-zinc-200/70 dark:border-zinc-700/70" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 bg-surface/70 p-10 text-center text-sm text-muted shadow-inner">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-text">Belum ada anggaran</p>
        <p className="text-sm text-muted">
          Tambahkan kategori anggaran untuk mulai mengontrol pengeluaranmu.
        </p>
      </div>
    </div>
  );
}

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

        const status = overBudget
          ? {
              label: 'Melebihi batas',
              icon: Flame,
              badgeClass:
                'bg-rose-500/10 text-rose-600 ring-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30',
              highlight: 'rgba(244, 63, 94, 0.18)',
              progressGradient: 'linear-gradient(90deg, rgba(244,63,94,0.95), rgba(248,113,113,0.7))',
              insight: `Pengeluaran sudah melebihi anggaran sebesar ${formatCurrency(Math.abs(remaining), 'IDR')}.`,
            }
          : percentage >= 90
            ? {
                label: 'Hampir habis',
                icon: AlertTriangle,
                badgeClass:
                  'bg-amber-500/10 text-amber-600 ring-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30',
                highlight: 'rgba(245, 158, 11, 0.18)',
                progressGradient: 'linear-gradient(90deg, rgba(245,158,11,0.9), rgba(253,186,116,0.7))',
                insight: `Sisa dana tinggal ${formatCurrency(remaining, 'IDR')} — waktunya rem pengeluaran.`,
              }
            : {
                label: 'Sehat',
                icon: CheckCircle2,
                badgeClass:
                  'bg-emerald-500/10 text-emerald-600 ring-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30',
                highlight: 'rgba(16, 185, 129, 0.18)',
                progressGradient: 'linear-gradient(90deg, rgba(16,185,129,0.9), rgba(52,211,153,0.7))',
                insight: `Masih tersedia ${formatCurrency(remaining, 'IDR')} dari anggaran ini.`,
              };

        const categoryName = row.category?.name ?? 'Tanpa kategori';
        const categoryInitial = categoryName.trim().charAt(0).toUpperCase() || 'B';
        const StatusIcon = status.icon;

        return (
          <article key={row.id} className={CARD_CLASS}>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-16 h-52 w-52 rounded-full blur-3xl"
              style={{ background: `radial-gradient(circle at center, ${status.highlight} 0%, rgba(255,255,255,0) 70%)` }}
            />

            <header className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-base font-semibold uppercase text-brand shadow-inner">
                    {categoryInitial}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-text dark:text-white">{categoryName}</h3>
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset shadow-sm backdrop-blur',
                          status.badgeClass,
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Periode {row.period_month?.slice(0, 7) ?? '-'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-3 py-1.5 text-xs font-medium text-muted shadow-inner">
                    <RefreshCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Carryover</span>
                    <span className="sm:hidden">CO</span>
                    <span className="text-[0.7rem] uppercase tracking-widest text-muted/80">
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
                      <span className="absolute inset-0 rounded-full bg-muted/30 transition peer-checked:bg-emerald-500/70 dark:bg-muted/40 dark:peer-checked:bg-emerald-500/60" />
                      <span className="relative ml-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-6 dark:bg-zinc-900" />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-surface/80 text-muted shadow-sm transition hover:-translate-y-0.5 hover:text-text"
                    aria-label={`Edit ${categoryName}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200/70 bg-rose-50/70 text-rose-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200"
                    aria-label={`Hapus ${categoryName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </header>

            <section className="space-y-5">
              <div className="rounded-2xl border border-border/50 bg-surface/70 p-4 shadow-inner">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted">Anggaran</span>
                    <p className="text-lg font-semibold text-text">{formatCurrency(planned, 'IDR')}</p>
                    <p className="text-xs text-muted">Dialokasikan</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted">Terpakai</span>
                    <p className="text-lg font-semibold text-text/90 dark:text-zinc-200">{formatCurrency(spent, 'IDR')}</p>
                    <p className="text-xs text-muted">{planned > 0 ? `${Math.min(100, Math.round((spent / planned) * 100))}% dari anggaran` : 'Tidak ada batas'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted">Sisa</span>
                    <p
                      className={clsx(
                        'text-lg font-semibold',
                        overBudget ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300',
                      )}
                    >
                      {formatCurrency(remaining, 'IDR')}
                    </p>
                    <p className="text-xs text-muted">{overBudget ? 'Perlu tindakan' : 'Masih tersedia'}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted">
                    <span>Progres penggunaan</span>
                    <span>{displayPercentage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20 dark:bg-muted/30">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${displayPercentage}%`, background: status.progressGradient }}
                    />
                  </div>
                  <p className={clsx('text-xs', overBudget ? 'text-rose-500 dark:text-rose-300' : 'text-muted')}>
                    {status.insight}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-border/60 bg-surface/70 p-4 text-sm shadow-inner">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/20 text-muted">
                    <NotebookPen className="h-4 w-4" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Catatan</p>
                    <p className="leading-relaxed text-text dark:text-zinc-100">
                      {row.notes?.trim() ? row.notes : 'Tidak ada catatan.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </article>
        );
      })}
    </div>
  );
}
