import { useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import useDailyDigest from "../hooks/useDailyDigest"
import { formatCurrency, humanDate } from "../lib/format.js"
import { useToast } from "../context/ToastContext.jsx"

interface KPIItemProps {
  label: string
  value: string
  helper?: string
  trend?: string
  tone?: "neutral" | "positive" | "negative"
}

function KPIItem({ label, value, helper, trend, tone = "neutral" }: KPIItemProps) {
  const trendTone = tone === "positive" ? "text-emerald-500" : tone === "negative" ? "text-rose-500" : "text-muted-foreground"
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-surface-1/95 p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-2xl font-bold tracking-tight text-text md:text-3xl tabular-nums">{value}</p>
        {trend ? <span className={`text-xs font-semibold ${trendTone}`}>{trend}</span> : null}
      </div>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
    </article>
  )
}

interface StatBadgeProps {
  label: string
  value: string
  helper: string
}

function StatBadge({ label, value, helper }: StatBadgeProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-[var(--accent)]/10 px-3 py-2 ring-1 ring-border/50">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-text tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{helper}</span>
    </div>
  )
}

interface ChipProps {
  label: string
  value: string
  percentage: string
  onClick?: () => void
}

function CategoryChip({ label, value, percentage, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--accent)]/10 px-3 py-2 text-left text-sm ring-1 ring-border/40 transition hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
      aria-label={`Lihat transaksi kategori ${label}`}
    >
      <span className="min-w-0 flex-1 font-medium text-text line-clamp-1">{label}</span>
      <span className="flex flex-col items-end text-xs text-muted-foreground">
        <span className="font-semibold text-text tabular-nums">{value}</span>
        <span>{percentage}</span>
      </span>
    </button>
  )
}

interface ListItemProps {
  icon: string
  title: string
  subtitle: string
  amount: string
  ariaLabel: string
}

function ListItem({ icon, title, subtitle, amount, ariaLabel }: ListItemProps) {
  return (
    <li
      className="flex min-h-[44px] items-center justify-between gap-3 py-2"
      aria-label={ariaLabel}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/20 text-base" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text line-clamp-1">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-text tabular-nums">{amount}</span>
    </li>
  )
}

function SkeletonBlock() {
  return (
    <div className="space-y-3">
      <div className="h-5 w-32 animate-pulse rounded-lg bg-muted/40" />
      <div className="h-8 w-24 animate-pulse rounded-lg bg-muted/30" />
      <div className="h-4 w-full animate-pulse rounded-lg bg-muted/30" />
    </div>
  )
}

interface EmptyStateProps {
  onAdd: () => void
}

function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border/60 bg-surface-1/95 p-6 text-left">
      <p className="text-sm font-medium text-text">Belum ada transaksi hari ini</p>
      <p className="text-xs text-muted-foreground">Catat pengeluaran pertama untuk mulai melihat ringkasan harian.</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
      >
        + Tambah Transaksi
      </button>
    </div>
  )
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%"
  const rounded = Math.max(0, Math.round(value))
  return `${rounded}%`
}

export default function DailyDigestCard() {
  const { data, loading, error, isRefreshing, refresh } = useDailyDigest()
  const toast = useToast()
  const navigate = useNavigate()
  const lastErrorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = null
      return
    }
    const message = error.message || "Gagal memuat Daily Digest"
    if (lastErrorRef.current === message) return
    lastErrorRef.current = message
    toast?.addToast?.(message, "error")
  }, [error, toast])

  const dateLabel = useMemo(() => (data ? humanDate(`${data.range.today}T00:00:00+07:00`) : ""), [data])

  const balanceTrend = useMemo(() => {
    if (!data) return null
    const delta = Math.round(Math.abs(data.balanceDelta))
    if (delta < 1) {
      return {
        label: "",
        helper: "Stabil dibanding kemarin.",
        tone: "neutral" as const,
      }
    }
    const direction = data.balanceDirection === "up" ? "▲" : "▼"
    const tone = data.balanceDirection === "up" ? "positive" : "negative"
    const valueLabel = `${direction} ${formatCurrency(delta, "IDR")}`
    const helper = data.balanceDirection === "up"
      ? `Naik ${formatCurrency(delta, "IDR")} dibanding kemarin.`
      : `Turun ${formatCurrency(delta, "IDR")} dibanding kemarin.`
    return { label: valueLabel, helper, tone }
  }, [data])

  const hasTodayData = data?.todayExpense.total && data.todayExpense.total > 0

  const handleAdd = () => {
    navigate("/add")
  }

  const handleViewMonthly = () => {
    navigate({ pathname: "/reports", search: `?range=month&from=${data?.range.monthStart ?? ""}&to=${data?.range.today ?? ""}` })
  }

  const handleExport = () => {
    navigate("/data")
  }

  const handleRefresh = () => {
    refresh({ skipCache: true })
  }

  const handleCategoryClick = (categoryId: string | null) => {
    const idParam = categoryId ?? "uncategorized"
    const from = data?.range.monthStart ?? ""
    const to = data?.range.today ?? ""
    navigate({ pathname: "/transactions", search: `?category=${idParam}&from=${from}&to=${to}` })
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-surface-1/95 p-5 shadow-sm ring-1 ring-border/40 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text md:text-xl">Daily Digest</h2>
          {dateLabel ? <p className="text-xs text-muted-foreground">Per {dateLabel}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {isRefreshing ? <span className="text-xs text-muted-foreground">Memperbarui…</span> : null}
          <button
            type="button"
            onClick={handleRefresh}
            aria-label="Muat ulang Daily Digest"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-sm text-text transition hover:bg-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
          >
            ↻
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="mt-6 space-y-4">
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : null}

      {!loading && data ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <KPIItem
              label="Saldo Aktif"
              value={formatCurrency(Math.round(data.balance), "IDR")}
              helper={balanceTrend?.helper ?? "Stabil dibanding kemarin."}
              trend={balanceTrend?.label}
              tone={balanceTrend?.tone ?? "neutral"}
            />

            <KPIItem
              label="Pengeluaran Hari Ini"
              value={formatCurrency(Math.round(data.todayExpense.total), "IDR")}
              helper={`vs rata-rata harian bulan ini ${formatPercent(data.todayExpense.vsAvgDailyMonthPct)}`}
            />

            <div className="grid gap-3 min-[420px]:grid-cols-2">
              <StatBadge
                label="WTD"
                value={formatCurrency(Math.round(data.wtd.total), "IDR")}
                helper={`${formatPercent(data.wtd.vsAvgWeekly3mPct)} dari rata-rata 3 bulan`}
              />
              <StatBadge
                label="MTD"
                value={formatCurrency(Math.round(data.mtd.total), "IDR")}
                helper={data.mtd.vsBudgetPct !== undefined && data.mtd.budgetAmount
                  ? `${formatPercent(data.mtd.vsBudgetPct)} dari budget ${formatCurrency(Math.round(data.mtd.budgetAmount), "IDR")}`
                  : "Belum ada budget bulan ini"}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text">Top Kategori (bulan ini)</h3>
              {data.topCategories.length ? (
                <div className="flex flex-wrap gap-2">
                  {data.topCategories.map((item) => (
                    <CategoryChip
                      key={item.id ?? item.name}
                      label={item.name}
                      value={formatCurrency(Math.round(item.total), "IDR")}
                      percentage={formatPercent(item.pctOfMTD)}
                      onClick={() => handleCategoryClick(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Belum ada kategori teratas bulan ini.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-surface-1/95 p-4">
              <h3 className="text-sm font-semibold text-text">Peringatan &amp; Jadwal Dekat</h3>
              <ul className="mt-3 divide-y divide-border/40" aria-label="Daftar peringatan dan jatuh tempo">
                {data.budgetWarnings.map((item) => (
                  <ListItem
                    key={item.id}
                    icon={item.status === "over" ? "🚨" : "⚠️"}
                    title={item.name}
                    subtitle={`${formatPercent(item.pct)} dari ${formatCurrency(Math.round(item.limit), "IDR")}`}
                    amount={formatCurrency(Math.round(item.spent), "IDR")}
                    ariaLabel={`Budget ${item.name} sudah ${formatPercent(item.pct)}`}
                  />
                ))}
                {data.upcoming.subscriptions.map((item) => (
                  <ListItem
                    key={`sub-${item.id}`}
                    icon="🧾"
                    title={item.name}
                    subtitle={`Jatuh tempo ${humanDate(`${item.dueDate}T00:00:00+07:00`)}`}
                    amount={formatCurrency(Math.round(item.amount), "IDR")}
                    ariaLabel={`Langganan ${item.name} jatuh tempo ${humanDate(`${item.dueDate}T00:00:00+07:00`)}`}
                  />
                ))}
                {data.upcoming.debts.map((item) => (
                  <ListItem
                    key={`debt-${item.id}`}
                    icon="📅"
                    title={item.name}
                    subtitle={`Jatuh tempo ${humanDate(`${item.dueDate}T00:00:00+07:00`)}`}
                    amount={formatCurrency(Math.round(item.amount), "IDR")}
                    ariaLabel={`Tagihan ${item.name} jatuh tempo ${humanDate(`${item.dueDate}T00:00:00+07:00`)}`}
                  />
                ))}
                {!data.budgetWarnings.length &&
                !data.upcoming.subscriptions.length &&
                !data.upcoming.debts.length ? (
                  <li className="py-2 text-xs text-muted-foreground">Tidak ada peringatan atau tagihan dalam 7 hari.</li>
                ) : null}
              </ul>
            </div>

            <div className="rounded-2xl border border-border/60 bg-surface-1/95 p-4">
              <h3 className="text-sm font-semibold text-text">Insight Cepat</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.insight}</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-surface-1/95 p-4">
              <h3 className="text-sm font-semibold text-text">Aksi Cepat</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs font-semibold text-text transition hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                  aria-label="Tambah transaksi baru"
                >
                  + Transaksi
                </button>
                <button
                  type="button"
                  onClick={handleViewMonthly}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs font-semibold text-text transition hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                  aria-label="Lihat detail bulanan"
                >
                  📊 Detail Bulanan
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-xs font-semibold text-text transition hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]"
                  aria-label="Ekspor data transaksi"
                >
                  ⬇️ Ekspor
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !hasTodayData && data ? (
        <div className="mt-6">
          <EmptyState onAdd={handleAdd} />
        </div>
      ) : null}
    </section>
  )
}
