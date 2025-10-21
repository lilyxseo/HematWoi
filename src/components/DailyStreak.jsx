import {
  IconFlame as Flame
} from '@tabler/icons-react';
import "./Animations.css";

export default function DailyStreak({ streak = 0 }) {
  if (streak <= 0) return null;
  return (
    <div className="card flex items-center gap-2 animate-slide">
      <Flame className="text-orange-500 w-5 h-5 animate-pulse" />
      <span className="font-semibold">{streak} hari streak</span>
    </div>
  );
}
