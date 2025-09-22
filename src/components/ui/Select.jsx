import { useId } from "react";

export default function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Pilih",
  helper,
  error,
  ...props
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        className="form-control appearance-none pr-10"
        {...props}
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
      {helper ? <p className="form-helper">{helper}</p> : null}
      {error ? <p className="form-error flex items-center gap-1">{error}</p> : null}
    </div>
  );
}
