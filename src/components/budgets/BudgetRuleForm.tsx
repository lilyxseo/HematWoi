import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { BudgetRulesUnavailableError, deleteRule, upsertRule } from '../../lib/api-budgets';
import type { BudgetRuleRecord } from '../../lib/api-budgets';
import type { BudgetViewModel } from './types';

interface BudgetRuleFormProps {
  budget: BudgetViewModel;
  rule?: BudgetRuleRecord;
  onSaved: () => void;
}

export default function BudgetRuleForm({ budget, rule, onSaved }: BudgetRuleFormProps) {
  const { addToast } = useToast();
  const [type, setType] = useState<'fixed' | 'percent-income' | 'smart'>(rule?.rule_type ?? 'fixed');
  const [value, setValue] = useState(() => Number(rule?.value ?? 0));
  const [note, setNote] = useState(rule?.note ?? '');
  const [active, setActive] = useState(rule?.active ?? true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setType(rule?.rule_type ?? 'fixed');
    setValue(Number(rule?.value ?? 0));
    setNote(rule?.note ?? '');
    setActive(rule?.active ?? true);
  }, [rule]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await upsertRule({
        id: rule?.id,
        category_id: budget.categoryId ?? null,
        rule_type: type,
        value,
        active,
        note,
      });
      addToast('Aturan anggaran tersimpan', 'success');
      onSaved();
    } catch (error) {
      if (error instanceof BudgetRulesUnavailableError) {
        addToast('Aturan anggaran belum tersedia di akun Anda', 'warning');
        onSaved();
      } else {
        addToast(`Gagal menyimpan aturan: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!rule?.id) return;
    setLoading(true);
    try {
      await deleteRule(rule.id);
      addToast('Aturan dihapus', 'success');
      onSaved();
    } catch (error) {
      if (error instanceof BudgetRulesUnavailableError) {
        addToast('Aturan anggaran belum tersedia di akun Anda', 'warning');
        onSaved();
      } else {
        addToast(`Gagal menghapus aturan: ${error instanceof Error ? error.message : 'tidak diketahui'}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm text-muted">Anggaran</p>
        <p className="text-lg font-semibold">{budget.label}</p>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="rule-type">
          Jenis aturan
        </label>
        <select
          id="rule-type"
          className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
          value={type}
          onChange={(event) => setType(event.target.value as typeof type)}
        >
          <option value="fixed">Nominal tetap</option>
          <option value="percent-income">Persentase pemasukan</option>
          <option value="smart">Smart (median 3 bulan)</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="rule-value">
          Nilai
        </label>
        <input
          id="rule-value"
          type="number"
          className="h-11 rounded-2xl border border-border bg-surface-2 px-3 text-sm"
          value={value}
          onChange={(event) => setValue(Number(event.target.value ?? 0))}
          min={0}
          step="0.01"
          required
        />
        <p className="text-xs text-muted">
          {type === 'fixed'
            ? 'Masukkan nominal rupiah.'
            : type === 'percent-income'
            ? 'Masukkan persentase pemasukan bulan ini.'
            : 'Smart rule menggunakan median pengeluaran 3 bulan terakhir.'}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted" htmlFor="rule-note">
          Catatan
        </label>
        <textarea
          id="rule-note"
          className="min-h-[90px] rounded-2xl border border-border bg-surface-2 px-3 py-2 text-sm"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Aktifkan aturan ini otomatis setiap bulan
      </label>
      <div className="flex flex-wrap justify-between gap-2">
        {rule?.id && (
          <button
            type="button"
            className="rounded-2xl border border-border px-4 py-2 text-sm text-red-500"
            onClick={handleDelete}
            disabled={loading}
          >
            Hapus aturan
          </button>
        )}
        <button
          type="submit"
          className="ml-auto rounded-2xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          disabled={loading}
        >
          {loading ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
