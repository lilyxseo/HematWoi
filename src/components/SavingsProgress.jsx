import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import "./Animations.css";

export default function SavingsProgress({ current = 0, target = 0 }) {
  const progress = target ? Math.min(current / target, 1) : 0;
  const [showCongrats, setShowCongrats] = useState(false);

  useEffect(() => {
    if (progress >= 1) {
      setShowCongrats(true);
      const t = setTimeout(() => setShowCongrats(false), 3000);
      return () => clearTimeout(t);
    }
  }, [progress]);

  return (
    <div className="card relative animate-slide">
      <h2 className="font-semibold mb-2 flex items-center gap-2">
        <span>Progress Tabungan</span>
        <span className="text-sm text-slate-500">
          Rp {current.toLocaleString("id-ID")} / Rp {target.toLocaleString("id-ID")}
        </span>
      </h2>
      <div
        className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded"
        role="progressbar"
      >
        <div
          className="h-3 bg-green-500 rounded"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="text-sm mt-1">{Math.round(progress * 100)}% tercapai</div>
      {showCongrats && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="card flex items-center gap-2 animate-slide">
            <CheckCircle className="text-green-500" />
            <span>Milestone tercapai! 🎉</span>
          </div>
        </div>
      )}
    </div>
  );
}
