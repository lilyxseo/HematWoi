import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export default function MoneyTalkBubble({ message, tip, avatar = "coin", onDismiss }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const icon = avatar === "bill" ? "💵" : "🪙";

  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-end px-4 sm:bottom-8 sm:px-8"
      aria-live="polite"
    >
      <div
        tabIndex={0}
        role="status"
        className={clsx(
          "pointer-events-auto card shadow-lg p-3 flex items-start gap-2 cursor-pointer focus:outline-none",
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
        <div
          className="pointer-events-auto mt-2 card shadow p-2 text-xs animate-slide"
          role="dialog"
        >
          {tip}
        </div>
      )}
    </div>,
    document.body
  );
}
