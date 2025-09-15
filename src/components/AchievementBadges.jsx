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

  return (
    <div className="card animate-slide">
      <h2 className="font-semibold mb-2">Achievements</h2>
      <ul className="space-y-2">
        {badges.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-2 text-sm bg-slate-50 dark:bg-slate-700 p-2 rounded"
          >
            {b.icon}
            <span>{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
