import { useId } from "react";

export default function Input({ label, type = "text", value, onChange, name, required, ...props }) {
  const id = useId();
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        required={required}
        {...props}
        className="peer w-full rounded-xl border border-border bg-surface-1 px-3 pt-5 pb-2 text-sm text-text focus:outline-none focus:ring-2"
        style={{ '--tw-ring-color': 'var(--brand)' }}
      />
      <label
        htmlFor={id}
        className="absolute left-3 top-2 text-xs text-muted transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-xs peer-focus:text-[var(--brand)]"
      >
        {label}
      </label>
    </div>
  );
}
