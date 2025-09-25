import { useId, useState } from "react";
import { Banknote } from "lucide-react";

const formatter = new Intl.NumberFormat("id-ID");

function formatDigits(value) {
  if (!value) return "";
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const parsed = Number.parseInt(digits, 10);
  if (Number.isNaN(parsed)) return "";
  return formatter.format(parsed);
}

export default function AmountInput({ value, onChange, error, helper, label = "Jumlah" }) {
  const id = useId();
  const [focused, setFocused] = useState(false);

  const handleChange = (event) => {
    const raw = event.target.value.replace(/[^0-9]/g, "");
    onChange(raw);
  };

  const displayValue = focused ? value : formatDigits(value);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Banknote className="h-4 w-4 text-primary" />
        {label}
      </label>
      <div
        className={`flex items-center gap-3 rounded-3xl border border-border/60 bg-background/80 px-5 py-4 shadow-sm transition focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-0 dark:border-white/10`}
      >
        <span className="text-base font-semibold text-muted-foreground">Rp</span>
        <input
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Masukkan jumlah"
          value={displayValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={handleChange}
          className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none md:text-4xl"
          aria-invalid={Boolean(error)}
        />
      </div>
      {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
