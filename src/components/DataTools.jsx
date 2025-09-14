export default function DataTools({ onExport, onImportJSON, onImportCSV, onManageCat }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn" onClick={onExport}>Export JSON</button>
      <label className="btn cursor-pointer">
        Import JSON
        <input
          type="file"
          accept="application/json"
          onChange={(e) => e.target.files?.[0] && onImportJSON(e.target.files[0])}
          className="hidden"
        />
      </label>
      <label className="btn cursor-pointer">
        Import CSV
        <input
          type="file"
          accept="text/csv"
          onChange={(e) => e.target.files?.[0] && onImportCSV(e.target.files[0])}
          className="hidden"
        />
      </label>
      <button className="btn" onClick={onManageCat}>Kelola Kategori</button>
    </div>
  );
}
