import { useMemo } from "react";
import { createSearchParams, useNavigate } from "react-router-dom";
import clsx from "clsx";
import type {
  BalanceSummary,
  DailyDigestData,
  PeriodSummary,
  TodayExpenseSummary,
  TopCategoryItem,
} from "../hooks/useDailyDigest";
import { formatCurrency } from "../lib/format";

interface DailyDigestCardProps {
  data: DailyDigestData | null;
  loading: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

interface KPIItemProps {
  title: string;
  value: string;
  description?: string;
  accent?: "positive" | "negative" | "neutral";
}

interface BadgeProps {
  label: string;
  value: string;
  ratioLabel: string;
}

interface UpcomingItem {
  id: string;
  label: string;
  hint: string;
  amount: number;
  tone: "info" | "warn";
}

function KPIItem({ title, value, description, accent = "neutral" }: KPIItemProps) {
  return (
    <div className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-border/60 transition dark:bg-slate-900/60">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{title}</div>
      <div
        className={clsx(
          "mt-1 text-2xl font-bold sm:text-3xl",
          accent === "positive" && "text-emerald-600 dark:text-emerald-400",
          accent === "negative" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </div>
      {description ? <p className="mt-1 text-xs text-muted sm:text-sm">{description}</p> : null}
    </div>
  );
}

function RatioBadge({ label, value, ratioLabel }: BadgeProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--accent)]/10 px-2.5 py-1 text-sm font-medium text-[var(--accent)] ring-1 ring-[var(--accent)]/30">
      <span className="truncate">{label}</span>
      <span className="truncate text-xs text-[var(--accent)]/70">{value}</span>
      <span className="truncate text-xs text-[var(--accent)]/70">{ratioLabel}</span>
    </div>
  );
}

function formatRatio(ratio: number | null | undefined): string {
  if (!ratio || !Number.isFinite(ratio)) return "–";
  return `${Math.round(ratio * 100)}%`;
}

function describeToday(today: TodayExpenseSummary): string {
  if (!today || today.avgDaily <= 0) return "vs rata-rata harian bulan ini";
  const ratio = formatRatio(today.ratio);
  return `vs rata-rata harian bulan ini (${ratio})`;
}

function describeBalance(balance: BalanceSummary): { label: string; accent: "positive" | "negative" | "neutral" } {
  if (Math.abs(balance.diff) < 1) {
    return { label: "Tidak berubah dari kemarin", accent: "neutral" };
  }
  const diffText = `${balance.diff > 0 ? "▲" : "▼"} ${formatCurrency(Math.abs(balance.diff))}`;
  return {
    label: `${diffText} vs kemarin`,
    accent: balance.diff > 0 ? "positive" : "negative",
  };
}

function formatBadgeValue(summary: PeriodSummary): string {
  return formatCurrency(summary.total);
}

function formatBudgetRatio(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "–";
  return `${Math.round(ratio * 100)}% dari budget`;
}

function buildUpcomingItems(data: DailyDigestData | null): UpcomingItem[] {
  if (!data) return [];
  const items: UpcomingItem[] = [];
  for (const warning of data.upcoming.budgets) {
    items.push({
      id: `budget-${warning.id}`,
      label: warning.name,
      hint: `${Math.round(warning.progressPct)}% dari ${formatCurrency(warning.planned)}`,
      amount: warning.actual,
      tone: warning.progressPct >= 100 ? "warn" : "info",
    });
  }
  for (const sub of data.upcoming.subscriptions) {
    items.push({
      id: `subscription-${sub.id}`,
      label: `${sub.name} • ${sub.dueDate}`,
      hint: "Langganan jatuh tempo",
      amount: sub.amount,
      tone: "info",
    });
  }
  for (const debt of data.upcoming.debts) {
    items.push({
      id: `debt-${debt.id}`,
      label: `${debt.name} • ${debt.dueDate}`,
      hint: "Pengingat pembayaran",
      amount: debt.amount,
      tone: "warn",
    });
  }
  return items.slice(0, 6);
}

function TopCategoryChip({
  category,
  onSelect,
}: {
  category: TopCategoryItem;
  onSelect: (category: TopCategoryItem) => void;
}) {
  const disabled = !category.id;
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(category)}
      disabled={disabled}
      className={clsx(
        "flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white/70 px-3 py-2 text-left text-sm transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-900/60",
      )}
      aria-label={disabled ? undefined : `Lihat transaksi kategori ${category.name}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="rounded-lg bg-[var(--accent)]/15 px-2 py-1 text-xs font-semibold text-[var(--accent)]">
          {Math.round(category.pctOfMonth)}%
        </span>
        <span className="min-w-0 truncate font-medium">{category.name}</span>
      </div>
      <span className="shrink-0 text-sm text-muted">{formatCurrency(category.total)}</span>
    </button>
  );
}

function InsightCard({ insight }: { insight: string }) {
  return (
    <div className="rounded-2xl bg-[var(--accent)]/8 p-4 text-sm text-[var(--accent)] ring-1 ring-[var(--accent)]/30">
      <span className="font-medium">Insight cepat:</span> {insight}
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-32 rounded bg-muted/40" />
      <div className="h-10 w-48 rounded bg-muted/30" />
      <div className="h-3 w-40 rounded bg-muted/30" />
      <div className="h-20 rounded-2xl bg-muted/20" />
      <div className="h-16 rounded-2xl bg-muted/20" />
      <div className="h-10 rounded-2xl bg-muted/20" />
    </div>
  );
}

export default function DailyDigestCard({ data, loading, error, onRetry }: DailyDigestCardProps) {
  const navigate = useNavigate();

  const upcomingItems = useMemo(() => buildUpcomingItems(data), [data]);
  const balanceDescription = data ? describeBalance(data.balance) : null;
  const emptyToday = data && !data.hasTodayTransactions && data.todayExpense.total <= 0;

  const handleAdd = () => navigate("/transaction/add");
  const handleMonthly = () => navigate("/budgets");
  const handleExport = () => {
    const params = createSearchParams({ tab: "transactions" });
    navigate({ pathname: "/data", search: params.toString() });
  };
  const handleCategorySelect = (item: TopCategoryItem) => {
    if (!item.id) return;
    const params = createSearchParams({ range: "month", categories: item.id });
    navigate({ pathname: "/transactions", search: params.toString() });
  };

  return (
    <section className="rounded-2xl bg-white/60 p-4 shadow-sm ring-1 ring-border/60 backdrop-blur dark:bg-slate-950/40 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Daily Digest</h2>
          <p className="text-xs text-muted sm:text-sm">Ringkasan singkat finansialmu</p>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label="Muat ulang Daily Digest"
          >
            Muat ulang
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="mt-4">
          <SkeletonBlock />
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          Gagal memuat ringkasan. {onRetry ? "Coba muat ulang." : "Silakan coba lagi nanti."}
        </div>
      ) : data ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-6">
          <div className="flex flex-col gap-4">
            <KPIItem
              title="Saldo akun aktif"
              value={formatCurrency(data.balance.total)}
              description={balanceDescription?.label}
              accent={balanceDescription?.accent ?? "neutral"}
            />
            <KPIItem
              title="Pengeluaran hari ini"
              value={formatCurrency(data.todayExpense.total)}
              description={describeToday(data.todayExpense)}
              accent={data.todayExpense.ratio > 1 ? "negative" : "positive"}
            />
            <div className="flex flex-wrap gap-2">
              <RatioBadge
                label="Week-to-date"
                value={formatBadgeValue(data.wtd)}
                ratioLabel={`${formatRatio(data.wtd.ratio)} dari rata-rata 3 bulan`}
              />
              <RatioBadge
                label="Month-to-date"
                value={formatCurrency(data.mtd.total)}
                ratioLabel={formatBudgetRatio(data.mtd.ratioToBudget)}
              />
            </div>
            <InsightCard insight={data.insight} />
            <div className="flex flex-wrap gap-2" aria-label="Aksi cepat Daily Digest">
              <button
                type="button"
                onClick={handleAdd}
                className="rounded-xl bg-[var(--accent)]/20 px-3 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label="Tambah transaksi baru"
              >
                ➕ Tambah Transaksi
              </button>
              <button
                type="button"
                onClick={handleMonthly}
                className="rounded-xl border border-border/60 px-3 py-2 text-sm font-medium text-muted transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label="Lihat detail bulanan"
              >
                📊 Detail Bulanan
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-xl border border-border/60 px-3 py-2 text-sm font-medium text-muted transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label="Ekspor transaksi"
              >
                ⬇️ Ekspor
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <section aria-label="Kategori teratas bulan ini" className="space-y-3">
              <h3 className="text-sm font-semibold text-text">Top kategori bulan ini</h3>
              {data.topCategories.length > 0 ? (
                <div className="space-y-2">
                  {data.topCategories.map((category) => (
                    <TopCategoryChip key={`${category.id ?? "uncategorized"}`} category={category} onSelect={handleCategorySelect} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Belum ada kategori yang dominan.</p>
              )}
            </section>
            <section aria-label="Pengingat dan agenda keuangan" className="space-y-3">
              <h3 className="text-sm font-semibold text-text">Upcoming & peringatan</h3>
              {upcomingItems.length > 0 ? (
                <ul className="divide-y divide-border/60 rounded-2xl ring-1 ring-border/40" role="list">
                  {upcomingItems.map((item) => (
                    <li key={item.id} className="flex min-h-[44px] items-center justify-between gap-3 bg-white/60 px-3 py-2 text-sm dark:bg-slate-900/60">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span>{item.tone === "warn" ? "⚠️" : "🔔"}</span>
                          <span className="truncate font-medium">{item.label}</span>
                        </div>
                        <p className="ml-6 text-xs text-muted">{item.hint}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-text">{formatCurrency(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Tidak ada peringatan 7 hari ke depan.</p>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {!loading && !error && emptyToday ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-white/40 p-4 text-sm text-muted dark:bg-slate-900/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Belum ada transaksi hari ini.</span>
            <button
              type="button"
              onClick={handleAdd}
              className="rounded-lg bg-[var(--accent)]/20 px-3 py-1.5 text-sm font-semibold text-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              aria-label="Tambah transaksi pertama hari ini"
            >
              Catat sekarang
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

