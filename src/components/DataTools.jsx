export default function DataTools({ onExport, onImportJSON, onImportCSV, onManageCat }) {
  const handleJSON = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) onImportJSON(file);
    e.target.value = '';
  };

  const handleCSV = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) onImportCSV(file);
    e.target.value = '';
  };

  return (
    <div className="card">
      <h2 className="font-semibold mb-2">Alat Data</h2>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={onExport}>
          Export JSON
        </button>
        <label className="btn cursor-pointer">
          Import JSON
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleJSON}
          />
        </label>
        <label className="btn cursor-pointer">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCSV}
          />
        </label>
        <button className="btn" onClick={onManageCat}>
          Kelola Kategori
        </button>
      </div>
    </div>
  );
}

