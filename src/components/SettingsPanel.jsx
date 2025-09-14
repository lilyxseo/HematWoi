import { useEffect, useState } from "react";
import Modal from "./Modal";

export default function SettingsPanel({ open, onClose, value, onChange }) {
  const [form, setForm] = useState(value);

  useEffect(() => {
    setForm(value);
  }, [value, open]);

  const handleSave = () => {
    onChange(form);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Tampilan</h3>
          <div className="space-y-3">
            <div>
              <div className="text-sm mb-1">Theme</div>
              <div className="flex gap-2">
                {[
                  ["system", "System"],
                  ["light", "Light"],
                  ["dark", "Dark"],
                ].map(([val, label]) => (
                  <label key={val} className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="theme"
                      value={val}
                      checked={form.theme === val}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, theme: e.target.value }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm mb-1">Density</div>
              <div className="flex gap-2">
                {[
                  ["comfortable", "Comfortable"],
                  ["compact", "Compact"],
                ].map(([val, label]) => (
                  <label key={val} className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="density"
                      value={val}
                      checked={form.density === val}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, density: e.target.value }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Preferensi Data</h3>
          <div className="space-y-3">
            <label className="block text-sm">
              <div className="mb-1">Default Bulan</div>
              <select
                className="input"
                value={form.defaultMonth}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultMonth: e.target.value }))
                }
              >
                <option value="current">Current</option>
                <option value="last">Last</option>
                <option value="none">None</option>
              </select>
            </label>
            <label className="block text-sm">
              <div className="mb-1">Format Mata Uang</div>
              <select
                className="input"
                value={form.currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currency: e.target.value }))
                }
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Simpan
          </button>
        </div>
      </div>
    </Modal>
  );
}
