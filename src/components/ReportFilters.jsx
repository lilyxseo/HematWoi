export default function ReportFilters({ month, months = [], onChange, comparePrev, onToggleCompare }) {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const handleMonthChange = (e) => {
    const val = e.target.value || currentMonth;
    onChange(val);
  };

  return (
    <div className="card">
      <div className="grid gap-3 sm:grid-cols-4 items-center">
        <select className="input" value={month} onChange={handleMonthChange}>
          <option value="">Pilih bulan…</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input type="date" className="input" disabled />
        <input type="date" className="input" disabled />
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={comparePrev}
              onChange={(e) => onToggleCompare(e.target.checked)}
            />
            <span className="text-sm">Bandingkan dengan bulan sebelumnya</span>
          </label>
          <button className="btn" onClick={() => onChange(currentMonth)}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
