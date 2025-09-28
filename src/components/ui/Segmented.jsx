import clsx from "clsx";

export default function Segmented({ value, onChange, options = [] }) {
  return (
    <div className="inline-flex items-stretch gap-1 rounded-xl border border-border bg-surface-alt/60 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={clsx(
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)]",
            value === opt.value
              ? "bg-brand text-brand-foreground shadow-sm"
              : "bg-transparent text-muted hover:bg-surface-alt"
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
