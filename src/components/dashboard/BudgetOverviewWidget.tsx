import { Link } from "react-router-dom"
import { PieChart, TrendingDown, Wallet } from "lucide-react"
import { formatCurrency } from "../../lib/format.js"
import { useBudgetOverview } from "../../hooks/useBudgetOverview"

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-")
  const yearNum = Number.parseInt(year ?? "", 10)
  const monthNum = Number.parseInt(month ?? "", 10)
  if (!Number.isFinite(yearNum) || !Number.isFinite(monthNum)) return "Periode ini"
  const formatter = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" })
  return formatter.format(new Date(yearNum, monthNum - 1, 1))
}

function getProgressClass(progress: number): string {
  if (progress >= 0.9) {
    return "bg-gradient-to-r from-rose-500 via-rose-500 to-rose-600"
  }
  if (progress >= 0.7) {
    return "bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500"
  }
  return "bg-gradient-to-r from-emerald-400 via-emerald-400 to-emerald-500"
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 1))
}

function WidgetSkeleton() {
  return (
    <section className="h-full rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur">
      <div className="flex h-full flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded-full bg-muted/60" />
            <div className="h-7 w-40 animate-pulse rounded-full bg-muted/60" />
            <div className="h-3 w-28 animate-pulse rounded-full bg-muted/40" />
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3898f8]/10">
            <PieChart className="h-6 w-6 text-[#3898f8]" />
          </span>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="h-10 w-32 animate-pulse rounded-xl bg-muted/60" />
              <div className="h-4 w-24 animate-pulse rounded-full bg-muted/40" />
            </div>
            <div className="space-y-3">
              <div className="h-10 w-32 animate-pulse rounded-xl bg-muted/60" />
              <div className="h-4 w-24 animate-pulse rounded-full bg-muted/40" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="h-4 w-10 animate-pulse rounded bg-muted/50" />
            </div>
            <div className="h-3 w-full rounded-full bg-muted/40">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-muted/70" />
            </div>
          </div>
        </div>
        <div className="hidden gap-4 rounded-2xl bg-muted/10 p-4 md:grid md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="h-4 w-24 animate-pulse rounded-full bg-muted/40" />
              <div className="h-3 w-full animate-pulse rounded-full bg-muted/30" />
              <div className="h-2 w-full animate-pulse rounded-full bg-muted/20" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function BudgetOverviewWidget() {
  const { summary, categories, loading, error, empty, period, refresh } = useBudgetOverview()
  const utilization = clampPercent(summary.utilization)
  const percentLabel = `${Math.round(utilization * 100)}%`
  const monthLabel = formatPeriodLabel(period)
  const remainingClass = summary.remaining < 0 ? "text-rose-500" : "text-emerald-600"

  const topCategories = categories
    .filter((item) => item.planned > 0 || item.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 3)

  if (loading) {
    return <WidgetSkeleton />
  }

  if (error) {
    return (
      <section className="h-full rounded-3xl border border-rose-200/60 bg-rose-50/70 p-6 text-rose-600 shadow-sm">
        <div className="flex h-full flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10">
                <TrendingDown className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Anggaran tidak dapat dimuat</h2>
                <p className="text-sm text-rose-500/80">{error}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refresh().catch(() => undefined)}
            className="inline-flex items-center justify-center rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
          >
            Coba Lagi
          </button>
        </div>
      </section>
    )
  }

  if (empty) {
    return (
      <section className="h-full rounded-3xl border border-dashed border-border/70 bg-card/60 p-6 shadow-sm">
        <div className="flex h-full flex-col items-start justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#3898f8]/10 px-3 py-1 text-xs font-semibold text-[#3898f8]">
              <Wallet className="h-4 w-4" /> Mulai rencanakan
            </span>
            <h2 className="text-xl font-semibold">Belum ada anggaran bulan ini</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              Buat anggaran untuk memantau penggunaan uang dan hindari overspending.
            </p>
          </div>
          <Link
            to="/budgets"
            className="inline-flex items-center justify-center rounded-2xl bg-[#3898f8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2f7dd0]"
          >
            Buat Anggaran
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="h-full rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur">
      <div className="flex h-full flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Anggaran</p>
            <h2 className="text-xl font-semibold text-foreground">Ringkasan Bulan Ini</h2>
            <p className="text-xs text-muted-foreground">Periode {monthLabel}</p>
          </div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3898f8]/10 text-[#3898f8]">
            <PieChart className="h-6 w-6" />
          </span>
        </header>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface/60 p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Total Anggaran</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatCurrency(summary.totalPlanned, "IDR")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Terpakai {formatCurrency(summary.totalActual, "IDR")}</p>
            </div>
            <div className="rounded-2xl bg-surface/60 p-4 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Sisa Anggaran</p>
              <p className={`mt-2 text-2xl font-semibold ${remainingClass}`}>
                {formatCurrency(summary.remaining, "IDR")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Persentase {percentLabel}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Penggunaan Anggaran</span>
              <span>{percentLabel}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted/40">
              <div
                className={`h-full rounded-full ${getProgressClass(utilization)}`}
                style={{ width: `${clampPercent(utilization) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-surface/60 p-4 shadow-sm md:p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Top Kategori</p>
            <Link to="/budgets" className="text-xs font-medium text-[#3898f8] hover:underline">
              Kelola
            </Link>
          </div>
          {topCategories.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Belum ada kategori dengan pengeluaran tercatat.
            </p>
          ) : (
            <ul className="mt-4 space-y-4 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
              {topCategories.map((item) => {
                const categoryProgress = clampPercent(item.utilization)
                return (
                  <li key={item.id} className="flex flex-col gap-3 rounded-xl bg-card/50 p-3 shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.actual, "IDR")} / {formatCurrency(item.planned, "IDR")}
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-muted/40">
                      <div
                        className={`h-full rounded-full ${getProgressClass(categoryProgress)}`}
                        style={{ width: `${categoryProgress * 100}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
