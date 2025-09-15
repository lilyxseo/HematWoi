import { useId } from "react";

export default function CurrencyInput({ label = "Jumlah", value, onChangeNumber, ...props }) {
  const id = useId();
  const formatter = new Intl.NumberFormat("id-ID");
  const display = value ? formatter.format(value) : "";

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const num = Number(raw || 0);
    onChangeNumber(num);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onChangeNumber((value || 0) + 1000);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onChangeNumber(Math.max(0, (value || 0) - 1000));
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        value={display}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        inputMode="numeric"
        placeholder=" "
        {...props}
        className="peer w-full rounded-xl border border-slate-300 bg-white dark:bg-slate-900 px-3 pt-5 pb-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      <label
        htmlFor={id}
        className="absolute left-3 top-2 text-xs text-slate-500 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:text-xs peer-focus:text-brand"
      >
        {label}
      </label>
    </div>
  );
}
