import { useId } from "react";

export default function Textarea({ label, value, onChange, name, required, ...props }) {
  const id = useId();
  return (
    <div className="relative">
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder=" "
        required={required}
        {...props}
        className="peer w-full rounded-xl border border-slate-300 bg-white dark:bg-slate-900 px-3 pt-5 pb-2 text-sm min-h-24 focus:outline-none focus:ring-2"
        style={{ '--tw-ring-color': 'var(--brand)' }}
      />
      <label
        htmlFor={id}
        className="absolute left-3 top-2 text-xs text-slate-500 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-xs peer-focus:text-[var(--brand)]"
      >
        {label}
      </label>
    </div>
  );
}
