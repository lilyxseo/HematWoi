import { Award, Target, Star } from "lucide-react";
import "./Animations.css";

function toRupiah(n = 0) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

export default function AchievementBadges({ stats = {}, streak = 0, target = 0 }) {
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
      icon: <Target className="h-4 w-4 text-green-500" />,
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
  if (!badges.length) return null;

  const visible = badges.slice(0, 4);
  const hasMore = badges.length > 4;

  return (
    <div className="card animate-slide h-full flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Achievements</h2>
        {hasMore && (
          <a href="#" className="text-xs text-brand-600 hover:underline">
            Lihat semua
          </a>
        )}
      </div>
      <ul className="divide-y divide-slate-200 overflow-y-auto flex-1 min-h-0">
        {visible.map((b) => (
          <li key={b.id} className="flex items-center gap-2 py-2 text-sm">
            {b.icon}
            <span className="line-clamp-1 sm:line-clamp-none">{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
