import { useState } from "react";
import clsx from "clsx";

export default function MoneyTalkBubble({ message, tip, avatar = "coin", onDismiss }) {
  const [open, setOpen] = useState(false);
  const icon = avatar === "bill" ? "💵" : "🪙";

  return (
    <div
      className="fixed inset-x-0 bottom-4 z-50 flex justify-end px-4 pointer-events-none"
      aria-live="polite"
    >
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
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
          <div className="card shadow p-2 text-xs animate-slide" role="dialog">
            {tip}
          </div>
        )}
      </div>
    </div>
  );
}
