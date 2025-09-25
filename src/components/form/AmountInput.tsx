import { forwardRef, useMemo } from 'react';
import clsx from 'clsx';

type AmountInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
  helper?: string;
  className?: string;
};

function formatRupiah(value: string): string {
  if (!value) return '';
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const number = Number.parseInt(digits, 10);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('id-ID').format(number);
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  ({ id, label, value, onChange, placeholder, error, helper, className }, ref) => {
    const displayValue = useMemo(() => formatRupiah(value), [value]);

    return (
      <div className={clsx('space-y-2', className)}>
        <label htmlFor={id} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className="relative overflow-hidden rounded-2xl border bg-background ring-2 ring-transparent focus-within:ring-2 focus-within:ring-primary">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Rp
            </div>
            <input
              id={id}
              ref={ref}
              inputMode="numeric"
              autoComplete="off"
              value={displayValue}
              onChange={(event) => {
                const next = event.target.value.replace(/[^0-9]/g, '');
                onChange(next);
              }}
              placeholder={placeholder}
              className="h-14 w-full bg-transparent py-3 pl-12 pr-4 text-3xl font-bold tracking-tight text-foreground outline-none"
            />
          </div>
        </label>
        {helper && !error ? <p className="text-sm text-muted-foreground">{helper}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  },
);

AmountInput.displayName = 'AmountInput';

export default AmountInput;
