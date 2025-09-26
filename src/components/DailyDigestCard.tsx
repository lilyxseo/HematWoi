import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useDailyDigest from "../hooks/useDailyDigest";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function formatIDR(value: number): string {
  return currencyFormatter.format(Math.round(value));
}

function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${percentageFormatter.format(value)}%`;
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted/60 ${className}`} />;
}

interface KPIItemProps {
  title: string;
  value: string;
  description?: string;
  accent?: "positive" | "negative" | "neutral";
  trendLabel?: string;
}

function KPIItem({ title, value, description, accent = "neutral", trendLabel }: KPIItemProps) {
  const accentClass =
    accent === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";

  return (
    <article className="rounded-2xl border border-border bg-white/70 p-4 shadow-sm dark:bg-zinc-900/50">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <div className={`mt-2 text-2xl font-bold md:text-3xl ${accentClass}`}>{value}</div>
      {trendLabel ? (
        <p className="mt-1 text-xs font-medium text-muted">{trendLabel}</p>
      ) : null}
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
    </article>
  );
}

interface DigestBadgeProps {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  hint?: string;
}

function DigestBadge({ label, value, tone = "neutral", hint }: DigestBadgeProps) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : "bg-[var(--accent)]/12 text-foreground";
  return (
    <div className={`rounded-xl border border-border px-2.5 py-1 text-sm font-medium shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
        <span>{value}</span>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface UpcomingItemProps {
  title: string;
  subtitle: string;
  amount: string;
  tone?: "warning" | "default";
}

function UpcomingItem({ title, subtitle, amount, tone = "default" }: UpcomingItemProps) {
  const toneClass = tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <li className="flex min-h-[44px] items-center justify-between gap-3 py-2">
      <div className="flex flex-col">
        <span className={`line-clamp-1 text-sm font-medium ${toneClass}`}>{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <span className="text-sm font-semibold text-foreground">{amount}</span>
    </li>
  );
}

interface UpcomingDigestListItem {
  key: string;
  title: string;
  subtitle: string;
  amount: string;
  tone?: "warning";
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white/70 p-4 text-center shadow-sm dark:bg-zinc-900/50">
      <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini.</p>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent)]"
      >
        Tambah Transaksi
      </button>
    </div>
  );
}

export default function DailyDigestCard() {
  const navigate = useNavigate();
  const { data, loading } = useDailyDigest();

  const digest = useMemo(() => data, [data]);
  const isRefreshing = loading && !!digest;

  const balanceTrend = useMemo(() => {
    if (!digest) return { symbol: "•", tone: "neutral", label: "Stabil dibanding kemarin" };
    if (digest.balanceChange > 0) {
      return {
        symbol: "▲",
        tone: "positive",
        label: `${formatIDR(digest.balanceChange)} lebih tinggi dari kemarin`,
      };
    }
    if (digest.balanceChange < 0) {
      return {
        symbol: "▼",
        tone: "negative",
        label: `${formatIDR(Math.abs(digest.balanceChange))} lebih rendah dari kemarin`,
      };
    }
    return { symbol: "•", tone: "neutral", label: "Stabil dibanding kemarin" };
  }, [digest]);

  const badges = useMemo(() => {
    if (!digest) return [];
    const wtdTone = digest.wtd.vsAvgWeekly3mPct > 110 ? "negative" : digest.wtd.vsAvgWeekly3mPct < 90 ? "positive" : "neutral";
    const mtdTone =
      digest.mtd.vsBudgetPct && digest.mtd.vsBudgetPct > 100
        ? "negative"
        : digest.mtd.vsBudgetPct && digest.mtd.vsBudgetPct < 80
          ? "positive"
          : "neutral";
    return [
      {
        id: "wtd",
        label: "WTD",
        value: formatIDR(digest.wtd.total),
        hint: digest.wtd.averageWeekly
          ? `${formatPercentage(digest.wtd.vsAvgWeekly3mPct)} dari rata-rata mingguan 3 bulan`
          : "Belum ada data pembanding",
        tone: wtdTone as DigestBadgeProps["tone"],
      },
      {
        id: "mtd",
        label: "MTD",
        value: formatIDR(digest.mtd.total ?? 0),
        hint: digest.mtd.vsBudgetPct != null
          ? `${formatPercentage(digest.mtd.vsBudgetPct)} dari batas anggaran`
          : "Belum ada anggaran bulan ini",
        tone: mtdTone as DigestBadgeProps["tone"],
      },
    ];
  }, [digest]);

  const upcomingItems = useMemo(() => {
    if (!digest) return [] as UpcomingDigestListItem[];
    const budgetWarnings: UpcomingDigestListItem[] = (digest.budgetWarnings || []).map((warning) => ({
      key: `budget-${warning.id}`,
      title: `Anggaran ${warning.name}`,
      subtitle: `${formatPercentage(warning.progressPct)} tercapai`,
      amount: formatIDR(warning.actual),
      tone: warning.progressPct >= 90 ? "warning" : undefined,
    }));
    const subscriptions: UpcomingDigestListItem[] = (digest.upcoming.subscriptions || []).map((item) => ({
      key: `sub-${item.id}`,
      title: item.name,
      subtitle: `Jatuh tempo ${dateFormatter.format(new Date(item.dueDate))}`,
      amount: formatIDR(item.amount),
    }));
    const debts: UpcomingDigestListItem[] = (digest.upcoming.debts || []).map((item) => ({
      key: `debt-${item.id}`,
      title: item.name,
      subtitle: `Bayar sebelum ${dateFormatter.format(new Date(item.dueDate))}`,
      amount: formatIDR(item.amount),
      tone: "warning" as const,
    }));
    return [...budgetWarnings, ...subscriptions, ...debts];
  }, [digest]);

  const showEmpty = !loading && digest && digest.todayExpense.total === 0 && !upcomingItems.length;

  const handleAddTransaction = () => navigate("/transaction/add");
  const handleMonthlyDetail = () => navigate("/reports");
  const handleExport = () => navigate("/data");

  const handleCategoryClick = (categoryId: string | null) => {
    if (!categoryId) return;
    const params = new URLSearchParams();
    params.set("categories", categoryId);
    params.set("range", "month");
    navigate({ pathname: "/transactions", search: params.toString() });
  };

  if (loading && !digest) {
    return (
      <section className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm dark:bg-zinc-900/50">
        <div className="flex flex-col gap-4">
          <SkeletonLine className="h-5 w-32" />
          <SkeletonLine className="h-8 w-40" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
          </div>
          <SkeletonLine className="h-20" />
          <SkeletonLine className="h-12" />
          <SkeletonLine className="h-10" />
        </div>
      </section>
    );
  }

  if (showEmpty) {
    return <EmptyState onCreate={handleAddTransaction} />;
  }

  if (!digest) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm dark:bg-zinc-900/50">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Daily Digest</h2>
        <p className="text-sm text-muted-foreground">Ringkasan cepat kondisi keuanganmu hari ini.</p>
        {isRefreshing ? (
          <div className="mt-2 flex items-center gap-3" aria-live="polite">
            <SkeletonLine className="h-2 w-20" />
            <SkeletonLine className="h-2 w-10" />
          </div>
        ) : null}
      </header>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <KPIItem
            title="Saldo Ringkas"
            value={formatIDR(digest.balance)}
            accent={balanceTrend.tone as KPIItemProps["accent"]}
            trendLabel={`${balanceTrend.symbol} ${balanceTrend.label}`}
          />

          <KPIItem
            title="Pengeluaran Hari Ini"
            value={formatIDR(digest.todayExpense.total)}
            description={
              digest.todayExpense.averageDaily
                ? `vs rata-rata harian bulan ini (${formatPercentage(digest.todayExpense.vsAvgDailyMonthPct)})`
                : "Belum ada data rata-rata harian"
            }
            accent={
              digest.todayExpense.vsAvgDailyMonthPct > 110
                ? "negative"
                : digest.todayExpense.vsAvgDailyMonthPct < 90
                  ? "positive"
                  : "neutral"
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {badges.map((badge) => (
              <DigestBadge
                key={badge.id}
                label={badge.label}
                value={badge.value}
                hint={badge.hint}
                tone={badge.tone}
              />
            ))}
          </div>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Top Kategori Bulan Ini</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {digest.topCategories.length ? (
                digest.topCategories.map((category) => (
                  <button
                    key={category.id ?? `category-${category.name}`}
                    type="button"
                    onClick={() => handleCategoryClick(category.id)}
                    disabled={!category.id}
                    className="group inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/20 px-3 py-1 text-sm font-medium text-foreground transition hover:bg-[var(--accent)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Lihat transaksi kategori ${category.name}`}
                    aria-disabled={!category.id}
                  >
                    <span className="line-clamp-1">{category.name}</span>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">
                      {formatIDR(category.total)} · {formatPercentage(category.pctOfMTD * 100)}
                    </span>
                  </button>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Belum ada kategori teratas.</span>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-[var(--accent)]/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Insight Cepat</h3>
            <p className="mt-2 text-sm text-foreground">{digest.insight}</p>
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAddTransaction}
              aria-label="Tambah transaksi baru"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--accent)]"
            >
              Tambah Transaksi
            </button>
            <button
              type="button"
              onClick={handleMonthlyDetail}
              aria-label="Lihat detail bulanan"
              className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            >
              Lihat Detail Bulanan
            </button>
            <button
              type="button"
              onClick={handleExport}
              aria-label="Ekspor data"
              className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            >
              Ekspor
            </button>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-white/70 p-4 shadow-sm dark:bg-zinc-900/50">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Peringatan &amp; Jatuh Tempo</h3>
            {upcomingItems.length ? (
              <ul className="mt-3 divide-y divide-border/60" aria-label="Daftar pengingat keuangan">
                {upcomingItems.map((item) => (
                  <UpcomingItem
                    key={item.key}
                    title={item.title}
                    subtitle={item.subtitle}
                    amount={item.amount}
                    tone={item.tone}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Tidak ada peringatan dalam 7 hari ke depan.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
