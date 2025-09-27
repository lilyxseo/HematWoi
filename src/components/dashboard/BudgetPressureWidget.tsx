import { useMemo } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight } from "lucide-react"

import { useBudgets } from "../../hooks/useBudgets"
import { formatCurrency } from "../../lib/format"
import Card, { CardBody, CardHeader } from "../Card"

function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  return `${year}-${month}`
}

const HIGHLIGHT_GRADIENT =
  "linear-gradient(90deg, hsl(var(--color-primary)) 0%, hsl(var(--color-primary-hover)) 45%, hsl(var(--color-primary-active)) 100%)"

export default function BudgetPressureWidget() {
  const { rows, loading, error } = useBudgets(getCurrentPeriod())

  const topBudgets = useMemo(() => {
    return rows
      .map((row) => {
        const planned = Number(row.amount_planned ?? 0)
        const spent = Number(row.spent ?? 0)
        const remaining = Number(row.remaining ?? planned - spent)
        const progress = planned > 0 ? spent / planned : 0
        const percentage = Number.isFinite(progress) ? progress * 100 : 0
        return {
          id: row.id,
          name: row.category?.name ?? "Kategori tanpa nama",
          planned,
          spent,
          remaining,
          percentage,
        }
      })
      .filter((row) => row.planned > 0)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)
  }, [rows])

  return (
    <Card className="overflow-hidden border border-border-subtle bg-surface shadow-sm">
      <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-12 h-44 w-44 rounded-full bg-brand/15 blur-3xl" />
      <CardHeader
        title="Budget Hampir Mencapai Batas"
        subtext="Pantau anggaran yang mendekati 100% agar tetap terkendali"
        actions={
          <Link
            to="/budget"
            className="inline-flex items-center gap-2 rounded-full border border-transparent bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            Info lengkap
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />
      <CardBody className="relative space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-border-subtle/80 bg-surface-alt/70 p-4"
              >
                <div className="flex justify-between gap-4">
                  <div className="h-4 w-36 rounded-full bg-border" />
                  <div className="h-4 w-12 rounded-full bg-border" />
                </div>
                <div className="mt-4 h-3 rounded-full bg-border" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : topBudgets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-subtle/70 bg-surface-alt/60 px-4 py-6 text-center text-sm text-muted">
            Belum ada data anggaran bulan ini.
          </div>
        ) : (
          <div className="space-y-3">
            {topBudgets.map((budget) => {
              const clamped = Math.min(100, Math.max(0, budget.percentage))
              const remainingLabel =
                budget.remaining >= 0
                  ? `${formatCurrency(budget.remaining, "IDR")} tersisa`
                  : `${formatCurrency(Math.abs(budget.remaining), "IDR")} terlampaui`
              return (
                <div
                  key={budget.id}
                  className="relative overflow-hidden rounded-2xl border border-border-subtle/70 bg-surface-alt/80 p-4 shadow-sm transition hover:border-brand/40 hover:bg-surface-alt"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted/80">Anggaran</p>
                      <h4 className="text-base font-semibold leading-tight text-text line-clamp-1">{budget.name}</h4>
                      <p className="text-xs text-muted">
                        {formatCurrency(budget.spent, "IDR")} dari {formatCurrency(budget.planned, "IDR")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span
                        className={`text-sm font-semibold ${clamped >= 100 ? "text-danger" : "text-brand"}`}
                      >
                        {Math.round(clamped)}%
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                        {remainingLabel}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-border/60">
                    <div
                      className="relative h-full rounded-full"
                      style={{
                        width: `${clamped}%`,
                        backgroundImage: HIGHLIGHT_GRADIENT,
                      }}
                    >
                      {clamped > 0 && (
                        <>
                          <span className="absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 translate-x-1/3 rounded-full bg-brand/40 blur" />
                          <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/4 rounded-full bg-brand shadow-[0_0_12px_rgba(255,255,255,0.35)]" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
