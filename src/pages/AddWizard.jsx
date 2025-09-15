import { useEffect, useState } from "react";
import Segmented from "../components/ui/Segmented";
import CurrencyInput from "../components/ui/CurrencyInput";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import Stepper from "../components/ui/Stepper";
import { Page } from "../components/ui/Page";
import { Card, CardBody } from "../components/ui/Card";

export default function AddWizard({ categories, onAdd, onCancel }) {
  const steps = [
    "Tipe & Jumlah",
    "Tanggal & Kategori",
    "Catatan",
    "Konfirmasi",
  ];
  const [step, setStep] = useState(0);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setCategory(categories[type]?.[0] || "");
  }, [type, categories]);

  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

  const next = () => {
    if (step === 0 && amount <= 0) return;
    if (step === 1 && (!date || !category)) return;
    if (step < steps.length - 1) setStep(step + 1);
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSave = () => {
    if (amount <= 0 || !date || !category) return;
    onAdd({ date, type, category, note, amount });
    onCancel();
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) back();
        else next();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (confirm("Batalkan?")) onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, amount, date, category, back, next, onCancel]);

  const presets = [
    { label: "+10k", val: 10000 },
    { label: "+100k", val: 100000 },
    { label: "+500k", val: 500000 },
  ];

  return (
    <Page title="Tambah Transaksi">
      <Card>
        <CardBody>
          <Stepper current={step} steps={steps} />

          {step === 0 && (
            <div className="space-y-4">
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { label: "Pemasukan", value: "income" },
                { label: "Pengeluaran", value: "expense" },
              ]}
            />
            <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.val}
                  type="button"
                  className="btn"
                  onClick={() => setAmount((a) => a + p.val)}
                >
                  {p.label}
                </button>
              ))}
              <button type="button" className="btn" onClick={() => setAmount(0)}>
                Clear
              </button>
            </div>
          </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Input
                type="date"
                label="Tanggal"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Select
                label="Kategori"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={categories[type] || []}
                placeholder="Pilih"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Textarea
                label="Catatan"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="card space-y-1">
                <div>{type === "income" ? "Pemasukan" : "Pengeluaran"}</div>
                <div>{date}</div>
                <div>{category}</div>
                <div>{formatter.format(amount)}</div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card space-y-1">
              <div>{type === "income" ? "Pemasukan" : "Pengeluaran"}</div>
              <div>{date}</div>
              <div>{category}</div>
              <div>{formatter.format(amount)}</div>
              {note && <div>{note}</div>}
            </div>
          )}

          <footer className="sticky bottom-0 bg-white dark:bg-slate-950 p-4 flex justify-between">
            <button className="btn" onClick={back} disabled={step === 0}>
              Kembali
            </button>
            {step < steps.length - 1 ? (
              <button className="btn btn-primary" onClick={next}>
                Lanjut
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSave}>
                Simpan Transaksi
              </button>
            )}
          </footer>
        </CardBody>
      </Card>
    </Page>
  );
}
