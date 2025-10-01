import {
  Award,
  Flame,
  Leaf,
  MoonStar,
  Sparkles,
  Target,
  Star,
} from "lucide-react";
import "./Animations.css";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

const JAKARTA_TIMEZONE = "Asia/Jakarta";

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: JAKARTA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getDateParts(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const parts = jakartaDateFormatter.formatToParts(date);
  const lookup = Object.create(null);
  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      lookup[part.type] = part.value;
    }
  }

  const year = Number.parseInt(lookup.year ?? "", 10);
  const month = lookup.month;
  const day = Number.parseInt(lookup.day ?? "", 10);

  if (!year || !month || !day) return null;

  return { year, month, day };
}

function getMonthKey(input) {
  const parts = getDateParts(input);
  if (!parts) return null;
  return `${parts.year}-${parts.month}`;
}

function getCurrentMonthKey(baseDate = new Date()) {
  const parts = getDateParts(baseDate);
  if (!parts) return null;
  return `${parts.year}-${parts.month}`;
}

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCategoryAggregations(txs = []) {
  return txs
    .filter((t) => t.type === "expense")
    .reduce((map, tx) => {
      const amount = toNumber(tx.amount);
      if (!amount) return map;

      const key = tx.category || "Lainnya";
      const existing = map.get(key) ?? {
        name: key,
        total: 0,
        count: 0,
        color: undefined,
      };

      existing.total += amount;
      existing.count += 1;
      if (!existing.color && typeof tx.category_color === "string" && tx.category_color) {
        existing.color = tx.category_color;
      }

      map.set(key, existing);
      return map;
    }, new Map());
}

function getPreviousMonth(date = new Date()) {
  const prev = new Date(date);
  prev.setMonth(prev.getMonth() - 1);
  return prev;
}

function calculateNoSpendStreak(expenseTxs = []) {
  if (!expenseTxs.length) {
    const today = new Date();
    const days = today.getDate();
    return days;
  }

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const spentDays = new Set(
    expenseTxs
      .map((tx) => {
        const date = new Date(tx.date);
        if (Number.isNaN(date.getTime())) return null;
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      })
      .filter((value) => value != null)
  );

  let longest = 0;
  let current = 0;

  for (
    let cursor = new Date(startOfMonth);
    cursor <= limit;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const key = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate()
    ).getTime();
    if (!spentDays.has(key)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

function formatPercentageDrop(previous, current) {
  if (!previous) return null;
  const drop = previous - current;
  if (drop <= 0) return null;
  return Math.round((drop / previous) * 100);
}

export default function AchievementBadges({
  stats = {},
  streak = 0,
  target = 0,
  txs = [],
}) {
  const badges = [];
  const balance = stats?.balance ?? 0;
  if (balance >= 500000) {
    badges.push({
      id: "saving",
      icon: <Star className="h-4 w-4 text-yellow-500" />,
      text: `Badge Hemat ${toRupiah(balance)} bulan ini 🎉`,
    });
  }
  if (target && balance >= target) {
    badges.push({
      id: "target",
      icon: <Target className="h-4 w-4 text-success" />,
      text: "Target tabungan tercapai 🎯",
    });
  }
  if (streak >= 3) {
    badges.push({
      id: "streak",
      icon: <Award className="h-4 w-4 text-orange-500" />,
      text: `Streak ${streak} hari 🔥`,
    });
  }
  const currentMonthKey = getCurrentMonthKey();
  const prevMonthKey = getMonthKey(getPreviousMonth());

  const monthTxs = txs.filter((tx) => getMonthKey(tx.date) === currentMonthKey);
  const prevMonthTxs = txs.filter((tx) => getMonthKey(tx.date) === prevMonthKey);

  const monthCategoryMap = getCategoryAggregations(monthTxs);
  const prevCategoryMap = getCategoryAggregations(prevMonthTxs);

  const monthCategories = Array.from(monthCategoryMap.values());

  if (monthCategories.length) {
    const topCategory = monthCategories.reduce(
      (max, cat) => (!max || cat.total > max.total ? cat : max),
      null
    );
    if (topCategory) {
      badges.push({
        id: "top-category",
        icon: <Flame className="h-4 w-4 text-destructive" />,
        text: `Pengeluaran terbesar ada di kategori ${topCategory.name} sebesar ${toRupiah(
          topCategory.total
        )}. Yuk cek lagi kebutuhannya!`,
      });
    }

    const favoriteCategory = monthCategories.reduce(
      (fav, cat) => (!fav || cat.count > fav.count ? cat : fav),
      null
    );
    if (favoriteCategory) {
      badges.push({
        id: "favorite-category",
        icon: <Sparkles className="h-4 w-4 text-brand" />,
        text: `Kategori favoritmu bulan ini adalah ${favoriteCategory.name} dengan ${favoriteCategory.count} transaksi.`,
      });
    }

    const bestImprovement = monthCategories
      .map((cat) => {
        const previous = prevCategoryMap.get(cat.name)?.total ?? 0;
        const drop = formatPercentageDrop(previous, cat.total);
        return { cat, previous, drop };
      })
      .filter((item) => item.drop != null && item.drop >= 10)
      .sort((a, b) => b.drop - a.drop)[0];

    if (bestImprovement) {
      badges.push({
        id: "category-improvement",
        icon: <Leaf className="h-4 w-4 text-success" />,
        text: `Pengeluaran ${bestImprovement.cat.name} turun ${bestImprovement.drop}% dibanding bulan lalu. Pertahankan!`,
      });
    }

    const noSpendStreak = calculateNoSpendStreak(
      monthTxs.filter((tx) => tx.type === "expense")
    );
    if (noSpendStreak >= 2) {
      badges.push({
        id: "no-spend-streak",
        icon: <MoonStar className="h-4 w-4 text-indigo-500" />,
        text: `Ada ${noSpendStreak} hari berturut-turut tanpa pengeluaran bulan ini. Good job!`,
      });
    }
  }

  if (!badges.length) return null;

  const visible = badges.slice(0, 4);

  return (
    <div className="card animate-slide h-full">
      <h2 className="mb-[var(--block-y)] font-semibold">Achievements</h2>
      <ul className="space-y-[var(--block-y)]">
        {visible.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-2 rounded bg-surface-2 p-2 text-sm"
          >
            {b.icon}
            <span className="line-clamp-2">{b.text}</span>
          </li>
        ))}
      </ul>
      {badges.length > visible.length && (
        <div className="mt-[var(--block-y)] text-right text-xs">
          <button className="underline">Lihat semua</button>
        </div>
      )}
    </div>
  );
}
