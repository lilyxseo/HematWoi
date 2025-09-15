export default function Segmented({ value, onChange, options = [] }) {
  return (
    <div className="inline-flex rounded-xl border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`px-3 py-2 text-sm flex-1 ${
            value === opt.value
              ? "bg-brand-var text-brand-foreground"
              : "bg-surface-1"
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
