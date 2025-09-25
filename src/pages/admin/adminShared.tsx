export const cardClass =
  'rounded-2xl border border-border/40 bg-background/80 p-6 shadow-sm ring-2 ring-border/40 backdrop-blur';
export const inputClass =
  'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm transition ring-2 ring-transparent focus:outline-none focus:ring-primary';
export const selectClass = `${inputClass} pr-10 appearance-none`;
export const textAreaClass =
  'min-h-[120px] w-full rounded-2xl border border-border/60 bg-background px-3 py-3 text-sm transition ring-2 ring-transparent focus:outline-none focus:ring-primary';
export const subtleButton =
  'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60';
export const primaryButton =
  'inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70';

export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? 'bg-primary/80' : 'bg-border'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
