import {
  Award,
  BadgePercent,
  PieChart,
  Star,
  Target,
  TrendingUp,
} from "lucide-react";
import "./Animations.css";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function summarizeTransactions(txs = []) {
  return txs.reduce((acc, tx) => {
    const category = tx.category || "Lainnya";
    const amount = Math.abs(Number(tx.amount) || 0);
    const bucket = acc.get(category) || {
      count: 0,
      income: 0,
      expense: 0,
    };

    bucket.count += 1;
    if (tx.type === "income") {
      bucket.income += amount;
    } else if (tx.type === "expense") {
      bucket.expense += amount;
    }

    acc.set(category, bucket);
    return acc;
  }, new Map());
}

function getTopEntry(entries, accessor) {
  return entries.reduce(
    (best, current) => {
      const currentValue = accessor(current[1]);
      if (currentValue <= 0) return best;
      if (!best) return current;
      const bestValue = accessor(best[1]);
      return currentValue > bestValue ? current : best;
    },
    null
  );
}

export default function AchievementBadges({
  stats = {},
  streak = 0,
  target = 0,
  txs = [],
}) {
  const balance = stats?.balance ?? 0;
  const summary = summarizeTransactions(txs);
  const entries = Array.from(summary.entries());

  const mostFrequentCategory = entries
    .filter(([, data]) => data.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)[0];

  const topExpenseCategory = getTopEntry(entries, (data) => data.expense);
  const topIncomeCategory = getTopEntry(entries, (data) => data.income);

  const badges = [];

  if (balance >= 500000) {
    badges.push({
      id: "saving",
      icon: <Star className="h-4 w-4 text-yellow-500" />,
      title: "Hemat Maksimal",
      text: `Tabungan bulan ini sudah menyentuh ${toRupiah(balance)}. Lanjutkan momentum emas ini!`,
    });
  }

  if (target && balance >= target) {
    badges.push({
      id: "target",
      icon: <Target className="h-4 w-4 text-success" />,
      title: "Target Tercapai",
      text: "Tabunganmu sudah melewati target yang ditetapkan. Saatnya bikin tujuan baru!",
    });
  }

  if (streak >= 3) {
    badges.push({
      id: "streak",
      icon: <Award className="h-4 w-4 text-orange-500" />,
      title: "Streak Konsisten",
      text: `Kamu bertransaksi aktif selama ${streak} hari berturut-turut. Konsistensi adalah kunci!`,
    });
  }

  if (mostFrequentCategory) {
    const [category, data] = mostFrequentCategory;
    badges.push({
      id: "favorite-category",
      icon: <PieChart className="h-4 w-4 text-brand" />,
      title: "Kategori Favorit",
      text: `Kategori ${category} jadi yang paling sering kamu pakai (${data.count} transaksi). Pertahankan strategi yang bekerja!`,
    });
  }

  if (topExpenseCategory) {
    const [category, data] = topExpenseCategory;
    badges.push({
      id: "top-expense",
      icon: <BadgePercent className="h-4 w-4 text-danger" />,
      title: "Pengeluaran Terbesar",
      text: `Kategori ${category} menyedot ${toRupiah(data.expense)} bulan ini. Worth it?`,
    });
  }

  if (topIncomeCategory) {
    const [category, data] = topIncomeCategory;
    badges.push({
      id: "top-income",
      icon: <TrendingUp className="h-4 w-4 text-success" />,
      title: "Aliran Dana Terbaik",
      text: `Kategori ${category} memberikan pemasukan terbesar: ${toRupiah(data.income)}. Mantap!`,
    });
  }

  if (!badges.length) return null;

  const progress = target ? Math.min(100, Math.round((balance / target) * 100)) : 0;

  return (
    <div className="card animate-slide h-full overflow-hidden">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/10 via-brand/5 to-transparent p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text">Achievements</h2>
          {target ? (
            <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-brand shadow-sm">
              {progress}% target tercapai
            </span>
          ) : null}
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Sorotan otomatis dari riwayat transaksi dan kebiasaanmu. Lanjutkan performa terbaikmu!
        </p>
        {target ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>Progress tabungan</span>
              <span>
                {toRupiah(balance)} / {toRupiah(target)}
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-white/50">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {badges.map((badge) => (
          <li
            key={badge.id}
            className="group flex flex-col gap-2 rounded-2xl border border-border-subtle/60 bg-surface-2 p-4 transition hover:border-brand/40 hover:bg-surface-alt/80"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-text">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 text-brand shadow-sm">
                {badge.icon}
              </span>
              <span>{badge.title}</span>
            </div>
            <p className="text-xs text-muted group-hover:text-text/80">{badge.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
