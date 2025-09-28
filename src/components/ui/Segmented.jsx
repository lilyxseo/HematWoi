import clsx from "clsx";

export default function Segmented({ value, onChange, options = [] }) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-border-subtle bg-surface-alt/30 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={clsx(
            "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:ring-[color:var(--brand-ring)]",
            value === opt.value
              ? "bg-brand-var text-brand-foreground shadow"
              : "text-muted-foreground hover:bg-surface-alt/60 hover:text-text"
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
