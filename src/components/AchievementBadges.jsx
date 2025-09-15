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
      icon: <Star className="w-4 h-4 text-yellow-500" />,
      text: `Badge Hemat ${toRupiah(balance)} bulan ini 🎉`,
    });
  }
  if (target && balance >= target) {
    badges.push({
      id: "target",
      icon: <Target className="w-4 h-4 text-green-500" />,
      text: "Target tabungan tercapai 🎯",
    });
  }
  if (streak >= 3) {
    badges.push({
      id: "streak",
      icon: <Award className="w-4 h-4 text-orange-500" />,
      text: `Streak ${streak} hari 🔥`,
    });
  }
  if (!badges.length) return null;

  return (
    <div className="card animate-slide">
      <h2 className="mb-2 font-semibold">Achievements</h2>
      <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-700">
        {badges.map((b) => (
          <li key={b.id} className="flex items-center gap-2 py-1.5">
            {b.icon}
            <span className="flex-1 leading-tight line-clamp-2">{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
