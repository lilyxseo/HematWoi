import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import type {
  BudgetCategoryProgress,
  BudgetProgressSummary,
  DailyDigestData,
  TopCategorySummary,
  UpcomingItem,
} from "../hooks/useDailyDigest";

interface DailyDigestModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  data: DailyDigestData | undefined;
  loading: boolean;
  error: Error | null;
  onRetry?: () => void;
  onAddTransaction?: () => void;
  onViewMonthly?: () => void;
  onSelectCategory?: (categoryId: string | null, categoryName: string) => void;
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(value || 0));
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return percentFormatter.format(Math.max(value, 0));
}

function formatUpcomingDate(value: string): string {
  try {
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isFinite(date.getTime())) return value;
    return dateFormatter.format(date);
  } catch {
    return value;
  }
}

function statusLabel(status: BudgetProgressSummary["status"]): { label: string; className: string } {
  switch (status) {
    case "over":
      return { label: "Melebihi", className: "bg-rose-500/10 text-rose-400" };
    case "warning":
      return { label: "Hampir penuh", className: "bg-amber-500/10 text-amber-400" };
    default:
      return { label: "Aman", className: "bg-emerald-500/10 text-emerald-400" };
  }
}

function categoryStatusClass(status: BudgetCategoryProgress["status"]): string {
  if (status === "over") return "border-rose-500/40 text-rose-300";
  if (status === "warning") return "border-amber-500/40 text-amber-200";
  return "border-emerald-500/30 text-emerald-200";
}

function renderSkeletonBlocks() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="h-20 animate-pulse rounded-2xl bg-slate-800/60"
        />
      ))}
    </div>
  );
}

function TopCategories({
  categories,
  total,
  onSelect,
}: {
  categories: TopCategorySummary[];
  total: number;
  onSelect?: (categoryId: string | null, categoryName: string) => void;
}) {
  if (!categories.length) {
    return <p className="text-sm text-slate-400">Belum ada kategori populer bulan ini.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((item) => {
        const percent = total > 0 ? formatPercent(item.percent) : "0%";
        const handleClick = () => {
          if (!onSelect) return;
          onSelect(item.id ?? null, item.name);
        };
        const Component = onSelect ? "button" : "div";
        return (
          <Component
            key={`${item.id ?? item.name}`}
            onClick={onSelect ? handleClick : undefined}
            className={clsx(
              "group flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-100",
              onSelect && "transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)]",
            )}
            type={onSelect ? "button" : undefined}
          >
            <span className="truncate">{item.name}</span>
            <span className="font-mono text-[0.75rem] text-slate-300">{formatCurrency(item.amount)}</span>
            <span className="text-[0.7rem] text-slate-400">{percent}</span>
          </Component>
        );
      })}
    </div>
  );
}

function UpcomingList({ items }: { items: UpcomingItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-slate-400">Tidak ada tagihan atau jatuh tempo 7 hari ke depan.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={`${item.type}-${item.id}`}
          className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/50 px-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-100">{item.name}</div>
            <div className="text-xs text-slate-400">
              {item.type === "subscription" ? "Langganan" : "Hutang"} • {formatUpcomingDate(item.dueDate)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-semibold text-slate-100">{formatCurrency(item.amount)}</div>
            <div className="text-[0.65rem] uppercase tracking-wide text-slate-500">{item.currency}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BudgetHighlights({ summary }: { summary: BudgetProgressSummary }) {
  const overall = statusLabel(summary.status);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Pengeluaran Bulan Ini</p>
          <p className="font-mono text-lg font-semibold text-slate-100">
            {formatCurrency(summary.spent)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">Budget</p>
          <p className="font-mono text-lg font-semibold text-slate-100">
            {formatCurrency(summary.planned)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{formatPercent(summary.percent)}</span>
        <span className={clsx("rounded-full px-2 py-0.5 text-[0.7rem] font-medium", overall.className)}>
          {overall.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {summary.categories.length ? (
          summary.categories.map((category) => (
            <div
              key={category.id ?? category.name}
              className={clsx(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-[0.7rem] font-medium",
                "bg-slate-800/60",
                categoryStatusClass(category.status),
              )}
            >
              <span className="truncate max-w-[8rem]">{category.name}</span>
              <span className="font-mono text-slate-200">{formatPercent(category.percent)}</span>
            </div>
          ))
        ) : (
          <span className="text-sm text-slate-400">Belum ada anggaran aktif bulan ini.</span>
        )}
      </div>
    </div>
  );
}

export default function DailyDigestModal({
  open,
  onOpenChange,
  data,
  loading,
  error,
  onRetry,
  onAddTransaction,
  onViewMonthly,
  onSelectCategory,
}: DailyDigestModalProps) {
  const balanceDirection = data?.balance.direction ?? "flat";
  const changeAmount = data ? Math.abs(data.balance.change) : 0;
  const changeLabel = data?.balance.direction === "flat" ? "—" : formatCurrency(changeAmount);
  const changePrefix = data?.balance.direction === "up" ? "▲" : data?.balance.direction === "down" ? "▼" : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 bottom-auto top-6 z-[95] mx-auto w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 p-4 shadow-xl ring-1 ring-slate-800 focus:outline-none sm:top-10 md:top-[15%] md:p-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <Dialog.Title className="text-lg font-semibold text-slate-100">Ringkasan Hari Ini</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-400">
                {data?.todayLabel ?? "Memuat rangkuman terbaru..."}
              </Dialog.Description>
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-200">
                <div className="flex items-center justify-between gap-3">
                  <span>Gagal memuat ringkasan. Coba lagi?</span>
                  {onRetry ? (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/30"
                    >
                      Muat ulang
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {loading ? (
              renderSkeletonBlocks()
            ) : data ? (
              <div className="space-y-4">
                <section className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Saldo Ringkas</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-slate-100">
                    {formatCurrency(data.balance.total)}
                  </p>
                  <p
                    className={clsx(
                      "mt-2 flex items-center gap-2 text-xs",
                      balanceDirection === "up"
                        ? "text-emerald-400"
                        : balanceDirection === "down"
                          ? "text-rose-400"
                          : "text-slate-400",
                    )}
                  >
                    <span>{changePrefix}</span>
                    <span>{changeLabel}</span>
                    <span className="text-slate-400">vs kemarin</span>
                  </p>
                </section>

                <section className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Pengeluaran Hari Ini</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-rose-200">
                    {formatCurrency(data.today.total)}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    vs rata-rata harian bulan ini ({formatCurrency(data.today.average)})
                  </p>
                </section>

                <section className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-400">MTD vs Budget</p>
                  <BudgetHighlights summary={data.budget} />
                </section>

                <section className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Top 3 Kategori ({data.monthLabel})
                  </p>
                  <div className="mt-3">
                    <TopCategories
                      categories={data.topCategories}
                      total={data.budget.spent}
                      onSelect={onSelectCategory}
                    />
                  </div>
                </section>

                <section className="rounded-2xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Upcoming 7 Hari</p>
                  <div className="mt-3">
                    <UpcomingList items={data.upcoming} />
                  </div>
                </section>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-400">
                <p>Belum ada data untuk ditampilkan.</p>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-800 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onAddTransaction}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-slate-950 shadow transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  Tambah Transaksi
                </button>
                <button
                  type="button"
                  onClick={onViewMonthly}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-[var(--accent)]/60 hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                >
                  Detail Bulanan
                </button>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                >
                  Tutup
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
