interface Props {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  tooltip?: string;
}

export default function Toggle({ label, checked, onChange, tooltip }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm" title={tooltip}>
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
