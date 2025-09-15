import { useState } from "react";
import Stepper from "../components/ui/Stepper";
import ImportMappingForm from "../components/ImportMappingForm";
import ImportPreview from "../components/ImportPreview";
import { parseCSV, parseOFX, normalizeRows } from "../lib/statement";
import { Page } from "../components/ui/Page";
import { Card, CardBody } from "../components/ui/Card";

export default function ImportWizard({ txs, onAdd, categories, rules, setRules, onCancel }) {
  const steps = ["Upload", "Mapping", "Preview"];
  const [step, setStep] = useState(0);
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ date: "", amount: "", note: "" });
  const [rows, setRows] = useState([]);

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target.result || "");
      let parsed;
      if (file.name.toLowerCase().endsWith(".ofx")) parsed = parseOFX(text);
      else parsed = parseCSV(text);
      setRawRows(parsed.rows);
      setHeaders(parsed.headers);
      setMapping({
        date: parsed.headers[0] || "",
        amount: parsed.headers[1] || "",
        note: parsed.headers[2] || "",
      });
      setStep(1);
    };
    reader.readAsText(file);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleMappingNext = () => {
    const normalized = normalizeRows(rawRows, mapping);
    setRows(normalized);
    setStep(2);
  };

  const handleImport = (items, newRules) => {
    if (newRules && Object.keys(newRules).length) {
      setRules((prev) => ({ ...prev, ...newRules }));
    }
    items.forEach(onAdd);
    onCancel();
  };

  return (
    <Page title="Import">
      <Card>
        <CardBody>
          <Stepper current={step} steps={steps} />
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="btn cursor-pointer">
                  Pilih File
                  <input
                    type="file"
                    accept=".csv,.ofx,text/csv,application/x-ofx,application/vnd.ms-ofx"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button className="btn" onClick={onCancel}>
                  Batal
                </button>
              </div>
            </div>
          )}
          {step === 1 && (
            <ImportMappingForm
              headers={headers}
              mapping={mapping}
              setMapping={setMapping}
              onNext={handleMappingNext}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <ImportPreview
              rows={rows}
              txs={txs}
              categories={categories}
              rules={rules}
              onBack={() => setStep(1)}
              onImport={handleImport}
            />
          )}
        </CardBody>
      </Card>
    </Page>
  );
}
