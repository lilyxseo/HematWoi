import { useState } from "react";
import Modal from "./Modal.jsx";
import { CHALLENGE_TEMPLATES } from "../lib/challenges.js";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

export default function ChallengeCreatorModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    title: "",
    type: "avoid",
    category: "",
    amount: 0,
    durationDays: 7,
    reminder: false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + Number(form.durationDays));
    const challenge = {
      id: uid(),
      title: form.title,
      type: form.type,
      durationDays: Number(form.durationDays),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      rules:
        form.type === "avoid"
          ? { category: form.category }
          : form.type === "limit"
          ? { category: form.category, limit: Number(form.amount), period: "day" }
          : { category: form.category, target: Number(form.amount) },
      rewardXP: 50,
      status: "active",
      progress: 0,
      reminder: form.reminder,
    };
    onSave(challenge);
    onClose();
  };

  const addTemplate = (tpl) => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + tpl.durationDays);
    const challenge = {
      ...tpl,
      id: uid(),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status: "active",
      progress: 0,
    };
    onSave(challenge);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Buat Challenge">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {CHALLENGE_TEMPLATES.map((t) => (
            <button
              key={t.title}
              type="button"
              className="btn"
              onClick={() => addTemplate(t)}
            >
              {t.title}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            required
            type="text"
            placeholder="Judul"
            className="input w-full"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="input w-full"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="avoid">Hindari</option>
            <option value="limit">Batasi</option>
            <option value="target">Target</option>
          </select>
          <input
            required
            type="text"
            placeholder="Kategori"
            className="input w-full"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          {form.type !== "avoid" && (
            <input
              type="number"
              placeholder="Jumlah"
              className="input w-full"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          )}
          <input
            type="number"
            placeholder="Durasi (hari)"
            className="input w-full"
            value={form.durationDays}
            onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.reminder}
              onChange={(e) => setForm({ ...form, reminder: e.target.checked })}
            />
            Reminder harian
          </label>
          <button type="submit" className="btn w-full">
            Simpan
          </button>
        </form>
      </div>
    </Modal>
  );
}
