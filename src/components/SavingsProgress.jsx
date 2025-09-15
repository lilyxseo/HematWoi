import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";
import "./Animations.css";

const STORAGE_KEY = "savings-milestone-achieved";

export default function SavingsProgress({ current = 0, target = 0 }) {
  const progress = target ? current / target : 0;
  const [achieved, setAchieved] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (progress >= 1) {
      setAchieved(true);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "true");
      }
    } else {
      setAchieved(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [progress]);

  return (
    <div className="card animate-slide">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Progress Tabungan</h2>
        {achieved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-4 w-4" /> Milestone tercapai!
          </span>
        )}
      </div>
      <div className="mb-2 text-sm text-slate-500">
        Rp {current.toLocaleString("id-ID")} / Rp {target.toLocaleString("id-ID")}
      </div>
      <div
        className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700"
        role="progressbar"
      >
        <div
          className="h-3 rounded bg-green-500"
          style={{ width: `${Math.min(progress, 1) * 100}%` }}
        />
      </div>
      <div className="mt-1 text-sm">
        {Math.round(Math.min(progress, 1) * 100)}% tercapai
      </div>
    </div>
  );
}
