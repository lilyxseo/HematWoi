import { useNavigate } from "react-router-dom";
import DataTools from "../components/DataTools";

export default function DataToolsPage({ onExport, onImportJSON, onImportCSV }) {
  const navigate = useNavigate();
  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="card">
        <h1 className="text-sm font-semibold">Data</h1>
      </div>
      <DataTools
        onExport={onExport}
        onImportJSON={onImportJSON}
        onImportCSV={onImportCSV}
        onManageCat={() => navigate("/categories")}
      />
    </main>
  );
}
