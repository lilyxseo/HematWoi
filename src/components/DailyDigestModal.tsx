import { Fragment, useMemo } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import {
  type DailyDigestData,
  type DailyDigestTopCategory,
  type DailyDigestUpcomingItem,
} from "../hooks/useDailyDigest"

const TIMEZONE = "Asia/Jakarta"

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  minimumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TIMEZONE,
})

interface DailyDigestModalProps {
  open: boolean
  data: DailyDigestData | undefined
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  onClose: () => void
  onRetry: () => void
  onAddTransaction: () => void
  onViewMonthly: () => void
  onSelectCategory: (categoryId: string) => void
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(value))
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%"
  return percentFormatter.format(Math.max(value, 0))
}

function formatDifferencePercent(value: number): string {
  if (!Number.isFinite(value)) return "0%"
  const rounded = Math.abs(Math.round(value))
  return `${value >= 0 ? "+" : "-"}${rounded}%`
}

function formatDate(value: string): string {
  if (!value) return ""
  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

function directionLabel(direction: "up" | "down" | "flat"): string {
  if (direction === "up") return "▲"
  if (direction === "down") return "▼"
  return "■"
}

function statusLabel(status: "safe" | "warning" | "over"): string {
  if (status === "over") return "Over"
  if (status === "warning") return "Waspada"
  return "Aman"
}

const blockClass = "rounded-2xl bg-slate-900 ring-1 ring-slate-800 p-4 md:p-6 flex flex-col gap-3"

function SkeletonBlock({ label }: { label: string }) {
  return (
    <div className={clsx(blockClass, "animate-pulse")}> 
      <div className="h-4 w-24 rounded bg-slate-800" aria-hidden />
      <div className="h-8 w-40 rounded bg-slate-800" aria-hidden />
      <div className="h-3 w-32 rounded bg-slate-800" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

function UpcomingList({ items }: { items: DailyDigestUpcomingItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-slate-400">Tidak ada jadwal 7 hari ke depan.</p>
  }
  return (
    <ul className="space-y-2 text-sm text-slate-200">
      {items.map((item) => (
        <li
          key={`${item.type}-${item.id}`}
          className="flex items-start justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-2"
        >
          <div>
            <div className="font-medium text-slate-100">{item.name}</div>
            <div className="text-xs text-slate-400">{formatDate(item.dueDate)}</div>
          </div>
          <div
            className={clsx(
              "whitespace-nowrap font-mono text-sm font-semibold",
              item.type === "subscription" ? "text-[var(--accent)]" : "text-emerald-300",
            )}
          >
            {formatCurrency(item.amount)}
          </div>
        </li>
      ))}
    </ul>
  )
}

function TopCategories({
  items,
  onSelect,
}: {
  items: DailyDigestTopCategory[]
  onSelect: (categoryId: string) => void
}) {
  if (!items.length) {
    return <p className="text-sm text-slate-400">Belum ada transaksi bulan ini.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="group inline-flex items-center gap-2 rounded-full bg-slate-950/60 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-[var(--accent)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <span className="font-medium">{item.name}</span>
          <span className="font-mono text-xs text-slate-400 group-hover:text-[var(--accent)]">
            {formatCurrency(item.amount)} · {formatPercent(item.percent)}
          </span>
        </button>
      ))}
    </div>
  )
}

function BudgetStatusBadge({ status }: { status: "safe" | "warning" | "over" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        status === "safe" && "bg-emerald-500/10 text-emerald-300",
        status === "warning" && "bg-amber-500/10 text-amber-300",
        status === "over" && "bg-rose-500/10 text-rose-300",
      )}
    >
      {statusLabel(status)}
    </span>
  )
}

function BudgetCategories({
  items,
}: {
  items: DailyDigestData["budget"]["categories"]
}) {
  if (!items.length) {
    return <p className="text-sm text-slate-400">Belum ada anggaran bulan ini.</p>
  }
  return (
    <ul className="space-y-2 text-sm text-slate-200">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-medium text-slate-100">{item.name}</span>
            <span className="text-xs text-slate-400">
              {formatCurrency(item.spent)} / {formatCurrency(item.planned)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{formatPercent(item.percent)}</span>
            <BudgetStatusBadge status={item.status} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function DailyDigestModal({
  open,
  data,
  isLoading,
  isFetching,
  error,
  onClose,
  onRetry,
  onAddTransaction,
  onViewMonthly,
  onSelectCategory,
}: DailyDigestModalProps) {
  const loading = isLoading && !data
  const derivedTopCategories = useMemo(
    () => data?.topCategories ?? [],
    [data],
  )

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto px-4 py-6 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-slate-950/95 ring-1 ring-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
              <div className="flex flex-col">
                <Dialog.Title className="text-lg font-semibold text-slate-50">
                  Ringkasan Hari Ini
                </Dialog.Title>
                {data ? (
                  <Dialog.Description className="text-xs text-slate-400">
                    Diperbarui {dateFormatter.format(new Date(data.generatedAt))}
                  </Dialog.Description>
                ) : null}
              </div>
              <Dialog.Close
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                aria-label="Tutup"
              >
                ×
              </Dialog.Close>
            </div>

            <div className="space-y-4 px-4 py-4 md:space-y-6 md:px-6">
              {error ? (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  <span>{error.message || "Gagal memuat ringkasan."}</span>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-lg bg-rose-400/20 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                  >
                    Coba lagi
                  </button>
                </div>
              ) : null}

              {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <SkeletonBlock label="Memuat saldo" />
                  <SkeletonBlock label="Memuat pengeluaran hari ini" />
                  <SkeletonBlock label="Memuat anggaran" />
                  <SkeletonBlock label="Memuat kategori" />
                  <SkeletonBlock label="Memuat jadwal" />
                </div>
              ) : data ? (
                <Fragment>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className={blockClass}>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Saldo Ringkas</div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-3xl font-semibold text-slate-50">
                          {formatCurrency(data.balance.total)}
                        </span>
                        <span
                          className={clsx(
                            "flex items-center gap-1 text-sm font-semibold",
                            data.balance.direction === "up" && "text-emerald-400",
                            data.balance.direction === "down" && "text-rose-400",
                            data.balance.direction === "flat" && "text-slate-400",
                          )}
                        >
                          <span>{directionLabel(data.balance.direction)}</span>
                          <span>{formatCurrency(Math.abs(data.balance.delta))}</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">dibanding kemarin</p>
                    </div>

                    <div className={blockClass}>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Pengeluaran Hari Ini</div>
                      <div className="font-mono text-3xl font-semibold text-rose-300">
                        {formatCurrency(data.spending.today)}
                      </div>
                      <p className="text-xs text-slate-400">
                        {data.spending.direction === "flat"
                          ? "Selevel dengan rata-rata harian bulan ini"
                          : `${data.spending.direction === "up" ? "Lebih tinggi" : "Lebih rendah"} ${formatDifferencePercent(data.spending.differencePercent)} vs rata-rata harian bulan ini`}
                      </p>
                    </div>

                    <div className={blockClass}>
                      <div className="text-xs uppercase tracking-wide text-slate-400">MTD vs Anggaran</div>
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <div className="font-mono text-2xl font-semibold text-slate-50">
                            {formatCurrency(data.budget.totalSpent)}
                          </div>
                          <div className="text-xs text-slate-500">
                            dari {formatCurrency(data.budget.totalPlanned)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-sm">
                          <span className="font-mono font-semibold text-[var(--accent)]">
                            {formatPercent(data.budget.percent)}
                          </span>
                          <BudgetStatusBadge status={data.budget.status} />
                        </div>
                      </div>
                      <BudgetCategories items={data.budget.categories} />
                    </div>

                    <div className={blockClass}>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Top 3 Kategori</div>
                      <TopCategories items={derivedTopCategories} onSelect={onSelectCategory} />
                    </div>

                    <div className={clsx(blockClass, "md:col-span-2")}
                      aria-live={isFetching ? "polite" : undefined}
                    >
                      <div className="text-xs uppercase tracking-wide text-slate-400">Upcoming 7 Hari</div>
                      <UpcomingList items={data.upcoming} />
                    </div>
                  </div>
                </Fragment>
              ) : (
                <p className="text-sm text-slate-400">Tidak ada data ringkasan untuk ditampilkan.</p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800/60 pt-4">
                <button
                  type="button"
                  onClick={onAddTransaction}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-black transition hover:bg-[var(--accent)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Tambah Transaksi
                </button>
                <button
                  type="button"
                  onClick={onViewMonthly}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Detail Bulanan
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
