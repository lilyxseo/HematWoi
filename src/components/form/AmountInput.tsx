import { forwardRef, useId } from 'react';
import clsx from 'clsx';

type AmountInputProps = {
  label: string;
  prefix?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  error?: string | null;
  disabled?: boolean;
};

const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  ({ label, prefix = 'Rp', value, onChange, placeholder = 'Masukkan jumlah', helperText, error, disabled }, ref) => {
    const id = useId();

    return (
      <div className="space-y-2">
        <label htmlFor={id} className="block text-sm font-medium text-muted-foreground">
          {label}
        </label>
        <div
          className={clsx(
            'flex items-center gap-3 rounded-2xl border border-border/60 bg-background/90 px-4 py-3 shadow-sm ring-2 ring-transparent transition focus-within:ring-primary/60 dark:border-zinc-700/70 dark:bg-zinc-900/60',
            disabled && 'opacity-60'
          )}
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{prefix}</span>
          <input
            ref={ref}
            id={id}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            disabled={disabled}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="h-14 w-full flex-1 appearance-none bg-transparent text-3xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
      </div>
    );
  }
);

AmountInput.displayName = 'AmountInput';

export default AmountInput;
