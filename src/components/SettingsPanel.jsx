import { useEffect, useState } from "react";
import Modal from "./Modal";
import ColorDot from "./ColorDot";

const ACCENTS = {
  blue: "#3898f8",
  emerald: "#10b981",
  violet: "#8b5cf6",
  amber: "#f59e0b",
};

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
            <div>
              <div className="text-sm mb-1">Accent Color</div>
              <div className="flex gap-2">
                {Object.entries(ACCENTS).map(([val, color]) => (
                  <label
                    key={val}
                    className="flex items-center gap-1 text-sm capitalize"
                  >
                    <input
                      type="radio"
                      name="accent"
                      value={val}
                      checked={form.accent === val}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, accent: e.target.value }))
                      }
                    />
                    <ColorDot color={color} />
                    {val}
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


        <div>
          <h3 className="font-semibold mb-2">Dompet Virtual</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.walletSound}
                onChange={(e) =>
                  setForm((f) => ({ ...f, walletSound: e.target.checked }))
                }
              />
              Efek suara
            </label>
            <div>
              <div className="text-sm mb-1">Sensitivitas Threshold</div>
              <div className="flex gap-2">
                {['low', 'default', 'high'].map((val) => (
                  <label
                    key={val}
                    className="flex items-center gap-1 text-sm capitalize"
                  >
                    <input
                      type="radio"
                      name="walletSensitivity"
                      value={val}
                      checked={form.walletSensitivity === val}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, walletSensitivity: e.target.value }))
                      }
                    />
                    {val}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.walletShowTips}
                onChange={(e) =>
                  setForm((f) => ({ ...f, walletShowTips: e.target.checked }))
                }
              />
              Tampilkan tips
            </label>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Tanggal Tua Mode</h3>
          <div className="space-y-3">
            <label className="block text-sm">
              <div className="mb-1">Mode</div>
              <select
                className="input"
                value={form.lateMode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lateMode: e.target.value }))
                }
              >
                <option value="auto">Auto</option>
                <option value="on">Always On</option>
                <option value="off">Disabled</option>
              </select>
            </label>
            <label className="block text-sm">
              <div className="mb-1">Tanggal mulai</div>
              <input
                type="number"
                min="1"
                max="31"
                className="input"
                value={form.lateModeDay}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lateModeDay: Number(e.target.value) }))
                }
              />
            </label>
            <label className="block text-sm">
              <div className="mb-1">Saldo menipis &lt; % pengeluaran bulanan</div>
              <input
                type="number"
                min="1"
                max="100"
                className="input"
                value={Math.round(form.lateModeBalance * 100)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lateModeBalance: Number(e.target.value) / 100 }))
                }
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>
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
