import { useId } from "react";

const PRESET_COLORS = [
  "#0EA5E9",
  "#6366F1",
  "#EC4899",
  "#22C55E",
  "#F97316",
  "#FACC15",
  "#14B8A6",
  "#64748B",
] as const;

interface ColorSwatchProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  name?: string;
}

function sanitizeHex(input: string): string {
  if (!input) return "#";
  const upper = input.toUpperCase();
  const prefixed = upper.startsWith("#") ? upper : `#${upper}`;
  const trimmed = prefixed.replace(/[^#0-9A-F]/gi, "");
  return trimmed.slice(0, 7);
}

export default function ColorSwatch({ value, onChange, disabled = false, name }: ColorSwatchProps) {
  const colorId = useId();
  const hexId = useId();
  const current = sanitizeHex(value) || "#";

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeHex(event.target.value);
    if (/^#[0-9A-F]{0,6}$/i.test(next)) {
      onChange(next);
    }
  };

  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeHex(event.target.value);
    if (/^#[0-9A-F]{6}$/i.test(next)) {
      onChange(next);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((preset) => {
          const isActive = preset === current;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset)}
              className="relative h-9 w-9 rounded-full border border-border-subtle/60 shadow-sm transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: preset }}
              aria-label={`Pilih warna ${preset}`}
              aria-pressed={isActive}
            >
              {isActive ? (
                <span
                  className="absolute inset-0 rounded-full border-[3px] border-border-strong ring-2 ring-primary/25"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={colorId} className="text-xs font-medium text-muted">
            Palet
          </label>
          <input
            id={colorId}
            name={name ? `${name}-color-picker` : undefined}
            type="color"
            className="h-11 w-14 cursor-pointer rounded-2xl border border-border-subtle bg-transparent p-1.5 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
            value={/^#[0-9A-F]{6}$/i.test(current) ? current : "#64748B"}
            onChange={handleColorChange}
            disabled={disabled}
            aria-label="Pilih warna menggunakan color picker"
          />
        </div>
        <div className="flex min-w-[160px] flex-1 items-center gap-2">
          <label htmlFor={hexId} className="text-xs font-medium text-muted">
            Kode HEX
          </label>
          <input
            id={hexId}
            name={name}
            type="text"
            inputMode="text"
            autoComplete="off"
            maxLength={7}
            value={current}
            onChange={handleTextChange}
            disabled={disabled}
            className="form-control flex-1 uppercase tracking-wide"
            placeholder="#RRGGBB"
          />
        </div>
      </div>
    </div>
  );
}
