import { useEffect, useState } from "react";
import clsx from "clsx";
import Skeleton from "./Skeleton";
import { generateMascotComment } from "../lib/mascotRules";

export default function FinanceMascot({ summary, budgets, onRefresh }) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!summary || !budgets) return;
    setVisible(false);
    const msg = generateMascotComment(summary, budgets);
    setMessage(msg);
    setVisible(true);
  }, [summary, budgets]);

  if (!summary || !budgets) {
    return <Skeleton className="h-20 w-full" />;
  }

  const handleNext = () => {
    setVisible(false);
    const msg = generateMascotComment(summary, budgets);
    setMessage(msg);
    setVisible(true);
    onRefresh?.();
  };

  return (
    <div className="flex items-start gap-3">
      <div className="text-4xl" aria-hidden>
        💸
      </div>
      <div className="relative max-w-xs">
        <div
          className={clsx(
            "rounded-lg bg-brand-secondary text-brand-text px-3 py-2 shadow transition-all duration-300 transform",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          )}
          aria-live="polite"
        >
          {message}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="absolute -bottom-5 right-0 text-xs text-brand hover:text-brand-hover"
        >
          Next tip
        </button>
      </div>
    </div>
  );
}
