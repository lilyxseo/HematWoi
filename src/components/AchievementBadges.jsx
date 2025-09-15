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
