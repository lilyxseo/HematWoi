import { useEffect, useState } from 'react';
import Input from './ui/Input';
import Select from './ui/Select';
import Textarea from './ui/Textarea';
import CurrencyInput from './ui/CurrencyInput';

export default function SubscriptionForm({ categories, initial, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState('monthly');
  const [dueDay, setDueDay] = useState('1');
  const [note, setNote] = useState('');
  const [autoDraft, setAutoDraft] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name || '');
      setCategory(initial.category || '');
      setAmount(initial.amount || 0);
      setPeriod(initial.period || 'monthly');
      setDueDay(initial.dueDay || '1');
      setNote(initial.note || '');
      setAutoDraft(!!initial.autoDraft);
    }
  }, [initial]);

  useEffect(() => {
    if (period === 'annual' && !dueDay.includes('-')) {
      setDueDay('01-01');
    } else if (period === 'monthly' && dueDay.includes('-')) {
      setDueDay('1');
    }
  }, [period, dueDay]);

  const allCategories = [
    ...(categories?.expense || []),
    ...(categories?.income || []),
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, category, amount, period, dueDay, note, autoDraft });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-3 p-4">
      <Input label="Nama" value={name} onChange={(e) => setName(e.target.value)} required />
      <Select
        label="Kategori"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        options={allCategories}
        placeholder="Pilih"
      />
      <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
      <Select
        label="Periode"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        options={[
          { label: 'Bulanan', value: 'monthly' },
          { label: 'Tahunan', value: 'annual' },
        ]}
      />
      {period === 'annual' ? (
        <Input
          type="date"
          label="Jatuh Tempo"
          value={`2000-${dueDay}`}
          onChange={(e) => setDueDay(e.target.value.slice(5))}
        />
      ) : (
        <Input
          type="number"
          label="Tanggal Jatuh Tempo"
          min="1"
          max="31"
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
        />
      )}
      <Textarea
        label="Catatan"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoDraft}
          onChange={(e) => setAutoDraft(e.target.checked)}
        />
        Auto draft transaksi
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary">
          Simpan
        </button>
      </div>
    </form>
  );
}

