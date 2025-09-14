export default function DataTools({ onExport, onImportJSON, onImportCSV, onManageCat }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn" onClick={onExport}>Export JSON</button>
      <button className="btn" onClick={onImportJSON}>Import JSON</button>
      <button className="btn" onClick={onImportCSV}>Import CSV</button>
      <button className="btn" onClick={onManageCat}>Kelola Kategori</button>
    </div>
  );
}
