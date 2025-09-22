import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { upsertBudget } from '../../lib/api-budgets';
import type { CarryRule } from '../../lib/api-budgets';

interface BudgetFormProps {
  period: string;
  categories: { id: string; name: string; type: 'income' | 'expense' }[];
  onSaved: () => void;
  onCancel: () => void;
}

const carryOptions: { value: CarryRule; label: string }[] = [
  { value: 'carry-positive', label: 'Bawa sisa positif' },
  { value: 'carry-all', label: 'Bawa semua (termasuk negatif)' },
  { value: 'none', label: 'Tidak dibawa' },
  { value: 'reset-zero', label: 'Reset ke nol' },
];

export default function BudgetForm({ period, categories, onSaved, onCancel }: BudgetFormProps) {
  const { addToast } = useToast();
  const [categoryId, setCategoryId] = useState<string>('');
  const [name, setName] = useState('');
  const [planned, setPlanned] = useState(0);
  const [carryRule, setCarryRule] = useState<CarryRule>('carry-positive');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryId && !name.trim()) {
      addToast('Nama anggaran wajib diisi untuk envelope tanpa kategori', 'warning');
      return;
    }
    setLoading(true);
    try {
      await upsertBudget({
        period,
        category_id: categoryId || undefined,
        name: categoryId ? undefined : name,
        planned,
        carry_rule: carryRule,
        note: note || undefined,
      });
      addToast('Anggaran berhasil disimpan', 'success');
      onSaved();
    } catch (error) {
      addToast(`Gagal menyimpan anggaran: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="budget-category">
          Kategori
        </label>
        <select
          id="budget-category"
          className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Envelope custom</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
      {!categoryId && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted" htmlFor="budget-name">
            Nama envelope
          </label>
          <input
            id="budget-name"
            className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Contoh: Dana darurat"
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="budget-planned">
          Rencana (IDR)
        </label>
        <input
          id="budget-planned"
          type="number"
          className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
          min={0}
          step="1000"
          value={planned}
          onChange={(event) => setPlanned(Number(event.target.value ?? 0))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="budget-carry">
          Aturan rollover
        </label>
        <select
          id="budget-carry"
          className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
          value={carryRule}
          onChange={(event) => setCarryRule(event.target.value as CarryRule)}
        >
          {carryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="budget-note">
          Catatan
        </label>
        <textarea
          id="budget-note"
          className="min-h-[90px] rounded-2xl border border-border bg-surface-2 px-3 py-2 text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-2xl border border-border px-4 py-2 text-sm"
          onClick={onCancel}
          disabled={loading}
        >
          Batal
        </button>
        <button
          type="submit"
          className="rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          disabled={loading}
        >
          {loading ? 'Menyimpan…' : 'Simpan anggaran'}
        </button>
      </div>
    </form>
  );
}
