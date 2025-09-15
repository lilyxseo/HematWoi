import { useState } from "react";
import clsx from "clsx";

export default function MoneyTalkBubble({ message, tip, avatar = "coin", onDismiss }) {
  const [open, setOpen] = useState(false);
  const icon = avatar === "bill" ? "💵" : "🪙";

  return (
    <div className="fixed bottom-4 right-4 z-50" aria-live="polite">
      <div
        tabIndex={0}
        role="status"
        className={clsx(
          "card shadow-lg p-3 flex items-start gap-2 cursor-pointer focus:outline-none",
          "animate-slide"
        )}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
          if (e.key === "Escape") onDismiss();
        }}
      >
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <div className="flex-1 text-sm">{message}</div>
        <button
          type="button"
          className="ml-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          &times;
        </button>
      </div>
      {open && tip && (
        <div className="mt-2 card shadow p-2 text-xs animate-slide" role="dialog">
          {tip}
        </div>
      )}
    </div>
  );
}
