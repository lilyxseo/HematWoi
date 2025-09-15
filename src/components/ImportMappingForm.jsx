export default function ImportMappingForm({ headers = [], mapping, setMapping, onNext, onBack }) {
  const handleChange = (field) => (e) => {
    setMapping({ ...mapping, [field]: e.target.value });
  };
  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <div>
          <label className="block text-sm">Tanggal</label>
          <select className="input w-full" value={mapping.date} onChange={handleChange("date")}>
            <option value="">Pilih kolom</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm">Jumlah</label>
          <select className="input w-full" value={mapping.amount} onChange={handleChange("amount")}>
            <option value="">Pilih kolom</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm">Catatan</label>
          <select className="input w-full" value={mapping.note} onChange={handleChange("note")}>
            <option value="">Pilih kolom</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-between">
        <button className="btn" type="button" onClick={onBack}>
          Kembali
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={onNext}
          disabled={!mapping.date || !mapping.amount || !mapping.note}
        >
          Lanjut
        </button>
      </div>
    </div>
  );
}
