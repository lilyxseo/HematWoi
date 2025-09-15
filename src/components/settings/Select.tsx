interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: Option[];
  onChange: (val: string) => void;
  tooltip?: string;
}

export default function Select({ label, value, options, onChange, tooltip }: Props) {
  return (
    <label className="block text-sm" title={tooltip}>
      <span className="mb-1 block">{label}</span>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
