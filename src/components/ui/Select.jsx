import { useId } from "react";

export default function Select({ label, options = [], value, onChange, placeholder = "Pilih", ...props }) {
  const id = useId();
  return (
    <label className="block text-sm space-y-1">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={onChange}
        {...props}
        className="w-full rounded-xl border border-slate-300 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </label>
  );
}
