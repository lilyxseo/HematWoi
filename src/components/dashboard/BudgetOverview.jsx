import { useMemo } from "react"
import { PieChart, Wallet, PiggyBank } from "lucide-react"
import { formatCurrency } from "../../lib/format.js"

function toNumber(value) {
  const parsed = Number.parseFloat(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatPeriodLabel(period) {
  if (!period) return "—"
  const [year, month] = String(period).split("-")
  if (!year || !month) return String(period)
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

function usageTone(pct) {
  if (pct >= 95) return "bg-rose-500"
  if (pct >= 80) return "bg-amber-500"
  return "bg-emerald-500"
}

function badgeTone(pct) {
  if (pct >= 100) return "text-rose-500"
  if (pct >= 85) return "text-amber-500"
  return "text-emerald-500"
}

export default function BudgetOverview({ budgets = [] }) {
  const summary = useMemo(() => {
    if (!Array.isArray(budgets) || budgets.length === 0) {
      return null
    }

    const periodMap = new Map()

    budgets.forEach((budget) => {
      const period = (budget?.period_month || budget?.month || "").slice(0, 7)
      if (!period) return
      const planned = toNumber(budget?.planned ?? budget?.amount_planned)
      const rollover = toNumber(budget?.rollover_in ?? budget?.rolloverIn)
      const allocated = planned + rollover
      const spent = toNumber(
        budget?.current_spent ?? budget?.actual ?? budget?.spent ?? 0,
      )
      const remaining = allocated - spent
      const label =
        budget?.label ??
        budget?.name ??
        budget?.category ??
        budget?.category_name ??
        "Tanpa kategori"

      if (!periodMap.has(period)) {
        periodMap.set(period, {
          planned: 0,
          rollover: 0,
          spent: 0,
          categories: [],
        })
      }

      const entry = periodMap.get(period)
      entry.planned += planned
      entry.rollover += rollover
      entry.spent += spent
      entry.categories.push({
        id: budget?.id ?? label,
        label,
        allocated,
        spent,
        remaining,
      })
    })

    if (!periodMap.size) return null

    const latestPeriod = Array.from(periodMap.keys()).sort().pop()
    if (!latestPeriod) return null

    const latest = periodMap.get(latestPeriod)
    const allocatedTotal = latest.planned + latest.rollover
    const spentTotal = latest.spent
    const remainingTotal = allocatedTotal - spentTotal
    const usagePct = allocatedTotal > 0 ? (spentTotal / allocatedTotal) * 100 : 0

    const categories = latest.categories
      .map((item) => {
        const base = item.allocated || 0
        const pct = base > 0 ? (item.spent / base) * 100 : 0
        return {
          ...item,
          base,
          pct,
          progress: Math.min(100, Math.max(0, pct)),
        }
      })
      .filter((item) => item.base > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4)

    return {
      period: latestPeriod,
      periodLabel: formatPeriodLabel(latestPeriod),
      totals: {
        allocated: allocatedTotal,
        planned: latest.planned,
        rollover: latest.rollover,
        spent: spentTotal,
        remaining: remainingTotal,
        usagePct,
      },
      categories,
    }
  }, [budgets])

  if (!summary) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Anggaran</h2>
            <p className="text-sm text-muted">
              Pantau alokasi anggaranmu setiap bulan di sini.
            </p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-6 text-sm text-muted">
          Belum ada data anggaran yang bisa diringkas.
        </p>
      </section>
    )
  }

  const {
    periodLabel,
    totals: { allocated, planned, rollover, spent, remaining, usagePct },
    categories,
  } = summary
  const usageProgress = Math.min(100, Math.max(0, usagePct))

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Anggaran</h2>
          <p className="text-sm text-muted">
            Ringkasan periode {periodLabel}
          </p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-surface-alt/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <PiggyBank className="h-4 w-4" /> Dialokasikan
          </div>
          <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(allocated, "IDR")}
          </p>
          <p className="mt-1 text-xs text-muted">
            Termasuk rollover {formatCurrency(rollover, "IDR")}
          </p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface-alt/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <PieChart className="h-4 w-4" /> Terpakai
          </div>
          <p className="mt-2 text-lg font-semibold tabular-nums text-rose-500">
            {formatCurrency(spent, "IDR")}
          </p>
          <p className="mt-1 text-xs text-muted">{formatCurrency(planned, "IDR")} anggaran utama</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface-alt/80 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Wallet className="h-4 w-4" /> Sisa
          </div>
          <p
            className={`mt-2 text-lg font-semibold tabular-nums ${
              remaining < 0 ? "text-rose-500" : "text-emerald-500"
            }`}
          >
            {formatCurrency(remaining, "IDR")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {remaining < 0 ? "Anggaran terlampaui" : "Masih tersedia untuk dibelanjakan"}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          <span>Tingkat penggunaan</span>
          <span className="tabular-nums text-foreground">
            {Math.round(usageProgress)}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted/60">
          <div
            className={`h-full rounded-full ${usageTone(usageProgress)}`}
            style={{ width: `${usageProgress}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-foreground">
          Kategori dengan penggunaan tertinggi
        </h3>
        {categories.length ? (
          <ul className="mt-4 space-y-3">
            {categories.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-border/60 bg-surface-alt/70 p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <span
                    className={`text-xs font-semibold tabular-nums ${badgeTone(item.pct)}`}
                  >
                    {Math.round(item.pct)}%
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>
                    {formatCurrency(item.spent, "IDR")} dari {formatCurrency(item.base, "IDR")}
                  </span>
                  <span>
                    Sisa {formatCurrency(Math.max(0, item.remaining), "IDR")}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted/60">
                  <div
                    className={`h-full rounded-full ${usageTone(item.progress)}`}
                    style={{ width: `${item.progress}%` }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Belum ada kategori aktif pada periode {periodLabel}.
          </p>
        )}
      </div>
    </section>
  )
}
