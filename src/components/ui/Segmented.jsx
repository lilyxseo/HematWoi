export default function Segmented({ value, onChange, options = [] }) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-border-subtle bg-surface-alt/60">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              isActive
                ? "bg-brand-var text-brand-foreground"
                : "bg-transparent text-muted-foreground hover:bg-surface-alt dark:text-slate-200"
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
