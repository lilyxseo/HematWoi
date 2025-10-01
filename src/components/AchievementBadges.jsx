import { useMemo } from "react";
import {
  Award,
  Target,
  Star,
  PieChart,
  Sparkles,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { aggregateInsights } from "../hooks/useInsights";
import "./Animations.css";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function extractTransactionLabel(tx = {}) {
  return (
    tx.title ||
    tx.description ||
    tx.notes ||
    tx.note ||
    tx.category ||
    "transaksi spesial"
  );
}

function summarizeCategories(txs = []) {
  const map = txs.reduce((acc, tx) => {
    if (tx.type !== "expense") return acc;
    const key = tx.category || "Lainnya";
    const existing = acc.get(key) ?? { name: key, value: 0, color: tx.category_color };
    const amount = Number(tx.amount || 0);
    if (!existing.color && typeof tx.category_color === "string" && tx.category_color) {
      existing.color = tx.category_color;
    }
    existing.value += amount;
    acc.set(key, existing);
    return acc;
  }, new Map());

  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

export default function AchievementBadges({ stats = {}, streak = 0, target = 0, txs = [] }) {
  const badges = [];
  const balance = stats?.balance ?? 0;

  const insights = useMemo(() => aggregateInsights(txs), [txs]);
  const monthlyCategories = insights?.categories ?? [];
  const monthlyTopCategory = monthlyCategories.reduce((best, item) => {
    if (!item || !Number(item.value)) return best;
    if (!best || Number(item.value) > Number(best.value)) return item;
    return best;
  }, null);
  const monthlyCategoryCount = monthlyCategories.filter((item) => Number(item.value) > 0).length;

  const biggestTx = insights?.topSpends?.[0];
  const netIncome = insights?.kpis?.net ?? 0;

  const lifetimeCategories = useMemo(() => summarizeCategories(txs), [txs]);
  const favoriteCategory = lifetimeCategories[0];

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
  if (netIncome > 0) {
    badges.push({
      id: "net-positive",
      icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
      text: `Pemasukan unggul ${toRupiah(netIncome)} bulan ini. Mantap!`,
    });
  }
  if (monthlyTopCategory) {
    badges.push({
      id: "top-category",
      icon: <PieChart className="h-4 w-4 text-sky-400" />,
      text: `${monthlyTopCategory.name} jadi fokus pengeluaranmu (${toRupiah(monthlyTopCategory.value)}).`,
    });
  }
  if (monthlyCategoryCount >= 3) {
    badges.push({
      id: "category-explorer",
      icon: <Sparkles className="h-4 w-4 text-purple-300" />,
      text: `Eksplor ${monthlyCategoryCount} kategori bulan ini. Jaga keseimbangannya ya!`,
    });
  }
  if (favoriteCategory) {
    badges.push({
      id: "lifetime-favorite",
      icon: <PieChart className="h-4 w-4 text-amber-300" />,
      text: `Sepanjang waktu, ${favoriteCategory.name} paling sering kamu alokasikan (${toRupiah(favoriteCategory.value)}).`,
    });
  }
  if (biggestTx && Number(biggestTx.amount) > 0) {
    const label = extractTransactionLabel(biggestTx);
    badges.push({
      id: "top-spend",
      icon: <Receipt className="h-4 w-4 text-rose-300" />,
      text: `Transaksi terbesar: ${label} senilai ${toRupiah(biggestTx.amount)}. Sudah sesuai prioritas?`,
    });
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
