import { useEffect, useRef } from "react";
import useLeveling from "../hooks/useLeveling.js";
import confetti from "canvas-confetti";

import novice from "../assets/avatars/novice.svg";
import planner from "../assets/avatars/planner.svg";
import saver from "../assets/avatars/saver.svg";
import expert from "../assets/avatars/expert.svg";
import sultan from "../assets/avatars/sultan.svg";

const STAGES = [
  { min: 1, src: novice, label: "Novice" },
  { min: 3, src: planner, label: "Planner" },
  { min: 5, src: saver, label: "Saver" },
  { min: 7, src: expert, label: "Expert" },
  { min: 9, src: sultan, label: "Sultan Hemat \uD83D\uDC51" },
];

export default function AvatarLevel({ transactions, insights, challenges }) {
  const { level, progress, needed } = useLeveling({
    transactions,
    insights,
    challenges,
  });
  const prevLevel = useRef(level);

  useEffect(() => {
    if (level > prevLevel.current) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      prevLevel.current = level;
    }
  }, [level]);

  const stage = STAGES.slice().reverse().find((s) => level >= s.min) || STAGES[0];
  const percent = needed ? Math.min(100, (progress / needed) * 100) : 0;

  return (
    <section
      aria-labelledby="avatar-level-heading"
      className="max-w-xs mx-auto text-center space-y-2"
    >
      <h2 id="avatar-level-heading" className="text-lg font-semibold">
        Level {level}
      </h2>
      <img src={stage.src} alt={stage.label} className="w-24 h-24 mx-auto" />
      <p className="text-sm">{stage.label}</p>
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={needed}
        className="w-full bg-surface-2 rounded h-2"
        title="Dapatkan XP: transaksi harian (+5), hemat mingguan \u2265 10% (+20), selesaikan challenge (+50)"
      >
        <div
          className="bg-success h-2 rounded"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs">
        {progress}/{needed} XP
      </p>
    </section>
  );
}
