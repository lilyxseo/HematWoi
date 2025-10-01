import { Award, CalendarRange, Sparkles, Star, Target, Trophy } from "lucide-react";
import "./Animations.css";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function getCurrentMonthTransactions(transactions = []) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return transactions.filter((tx) => {
    const date = new Date(tx.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });
}

function summarizeMonth(transactions = []) {
  const monthTx = getCurrentMonthTransactions(transactions);
  let income = 0;
  let expense = 0;
  const expenseByCategory = new Map();
  const expenseDays = new Set();

  for (const tx of monthTx) {
    const amount = Number(tx.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (tx.type === "income") {
      income += amount;
    }
    if (tx.type === "expense") {
      expense += amount;

      const category = tx.category || "Lainnya";
      expenseByCategory.set(category, (expenseByCategory.get(category) ?? 0) + amount);

      const dateKey = new Date(tx.date).toDateString();
      expenseDays.add(dateKey);
    }
  }

  let topCategory = null;
  for (const [name, total] of expenseByCategory.entries()) {
    if (!topCategory || total > topCategory.total) {
      topCategory = { name, total };
    }
  }

  const today = new Date();
  const todayDate = today.getDate();
  const noSpendDays = Array.from({ length: todayDate }).reduce((count, _, index) => {
    const day = index + 1;
    const key = new Date(today.getFullYear(), today.getMonth(), day).toDateString();
    return expenseDays.has(key) ? count : count + 1;
  }, 0);

  return {
    income,
    expense,
    topCategory,
    categoryCount: expenseByCategory.size,
    noSpendDays,
  };
}

export default function AchievementBadges({
  stats = {},
  streak = 0,
  target = 0,
  transactions = [],
}) {
  const balance = stats?.balance ?? 0;

  const monthSummary = summarizeMonth(transactions);
  const achievements = [];

  if (target > 0) {
    const progress = Math.min(balance / target, 1);
    achievements.push({
      id: "savings-progress",
      icon: <Target className="h-5 w-5 text-[color:var(--brand-primary)]" />,
      title: "Progress Target Tabungan",
      description: `Sudah mencapai ${Math.round(progress * 100)}% dari target ${toRupiah(target)}.`,
      progress,
      meta: `${toRupiah(balance)} tersimpan`,
    });
  }

  if (balance >= 500000) {
    achievements.push({
      id: "saving",
      icon: <Star className="h-5 w-5 text-yellow-500" />,
      title: "Badge Hemat",
      description: `Saldo bulan ini sudah menyentuh ${toRupiah(balance)}. Pertahankan ritmemu!`,
    });
  }

  if (streak >= 2) {
    achievements.push({
      id: "streak",
      icon: <Award className="h-5 w-5 text-orange-500" />,
      title: "Streak Transaksi Aktif",
      description: `Mencatat transaksi selama ${streak} hari berturut-turut. Kebiasaan baik sedang terbentuk!`,
      meta: "Catat satu transaksi lagi besok untuk lanjutkan streak.",
    });
  }

  if (monthSummary.topCategory) {
    achievements.push({
      id: "top-category",
      icon: <Trophy className="h-5 w-5 text-emerald-500" />,
      title: "Kategori Fokus Bulan Ini",
      description: `${monthSummary.topCategory.name} menyedot ${toRupiah(
        monthSummary.topCategory.total
      )} dari pengeluaranmu. Saatnya evaluasi atau beri batasan baru.`,
    });
  }

  if (monthSummary.categoryCount >= 3) {
    achievements.push({
      id: "category-explorer",
      icon: <Sparkles className="h-5 w-5 text-sky-500" />,
      title: "Kategori Variatif",
      description: `Pengeluaranmu tersebar di ${monthSummary.categoryCount} kategori berbeda. Atur prioritas agar fokus pada yang terpenting.`,
    });
  }

  if (monthSummary.noSpendDays >= 1) {
    achievements.push({
      id: "no-spend",
      icon: <CalendarRange className="h-5 w-5 text-purple-500" />,
      title: "Hari Tanpa Pengeluaran",
      description: `Ada ${monthSummary.noSpendDays} hari di bulan ini tanpa pengeluaran. Momentum bagus untuk menjaga cashflow!`,
    });
  }

  if (monthSummary.income || monthSummary.expense) {
    const net = monthSummary.income - monthSummary.expense;
    achievements.push({
      id: "net-balance",
      icon: <Trophy className="h-5 w-5 text-brand" />,
      title: net >= 0 ? "Saldo Bulan Ini Tumbuh" : "Saatnya Rem Pengeluaran",
      description:
        net >= 0
          ? `Pendapatan bulan ini masih unggul ${toRupiah(net)} dibanding pengeluaran. Bisa dialihkan ke tabungan atau investasi!`
          : `Pengeluaran melebihi pendapatan sebesar ${toRupiah(Math.abs(net))}. Cek kategori besar dan susun strategi hemat.`,
    });
  }

  if (!achievements.length) return null;

  const visible = achievements.slice(0, 5);

  return (
    <div className="card animate-slide h-full">
      <div className="mb-[var(--block-y)] flex items-center justify-between gap-2">
        <h2 className="font-semibold">Achievements</h2>
        {target > 0 && (
          <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted">
            Target: {toRupiah(target)}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {visible.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-border/60 bg-surface-2/50 p-3 text-sm shadow-sm backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-surface-alt p-2">{item.icon}</div>
              <div className="flex-1 space-y-1">
                <p className="font-semibold leading-snug">{item.title}</p>
                <p className="text-xs leading-relaxed text-muted">{item.description}</p>
                {typeof item.progress === "number" && (
                  <div className="mt-2 space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
                      <div
                        className="h-full rounded-full bg-[color:var(--brand-primary)] transition-all"
                        style={{ width: `${Math.min(item.progress, 1) * 100}%` }}
                      />
                    </div>
                    {item.meta && (
                      <p className="text-[11px] font-medium text-muted">{item.meta}</p>
                    )}
                  </div>
                )}
                {item.meta && typeof item.progress !== "number" && (
                  <p className="text-[11px] font-medium text-muted">{item.meta}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
