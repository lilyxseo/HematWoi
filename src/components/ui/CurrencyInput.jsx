import { useId } from "react";

export default function CurrencyInput({
  label = "Jumlah",
  value,
  onChangeNumber,
  helper,
  error,
  ...props
}) {
  const id = useId();
  const formatter = new Intl.NumberFormat("id-ID");
  const display = value ? formatter.format(value) : "";

  const handleChange = (event) => {
    const raw = event.target.value.replace(/[^0-9]/g, "");
    const num = Number(raw || 0);
    onChangeNumber(num);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onChangeNumber((value || 0) + 1000);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onChangeNumber(Math.max(0, (value || 0) - 1000));
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <input
          id={id}
          value={display}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          inputMode="numeric"
          placeholder=" "
          aria-invalid={Boolean(error)}
          {...props}
          className="peer min-h-[3rem] w-full rounded-2xl border border-border-subtle bg-surface-alt px-4 pb-1 pt-4 text-right text-sm text-text tabular-nums transition-colors placeholder:text-transparent focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-2 text-xs font-medium text-muted transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-placeholder-shown:text-muted peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-primary"
        >
          {label}
        </label>
      </div>
      {helper ? <p className="form-helper">{helper}</p> : null}
      {error ? <p className="form-error flex items-center gap-1">{error}</p> : null}
    </div>
  );
}
