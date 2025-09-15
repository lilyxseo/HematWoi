interface Props {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  tooltip?: string;
}

export default function NumberField({ label, value, onChange, min, max, tooltip }: Props) {
  return (
    <label className="block text-sm" title={tooltip}>
      <span className="mb-1 block">{label}</span>
      <input
        type="number"
        className="input"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
      />
    </label>
  );
}
