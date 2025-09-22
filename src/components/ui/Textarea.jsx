import { useId } from "react";

export default function Textarea({
  label,
  value,
  onChange,
  name,
  required,
  helper,
  error,
  ...props
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder=" "
          required={required}
          aria-invalid={Boolean(error)}
          {...props}
          className="peer min-h-[120px] w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 pb-2 pt-5 text-sm text-text transition-colors placeholder:text-transparent focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-3 top-2 text-xs font-medium text-muted transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-placeholder-shown:text-muted peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary"
        >
          {label}
        </label>
      </div>
      {helper ? <p className="form-helper">{helper}</p> : null}
      {error ? <p className="form-error flex items-center gap-1">{error}</p> : null}
    </div>
  );
}
