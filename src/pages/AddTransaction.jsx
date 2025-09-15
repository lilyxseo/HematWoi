import { useState, useEffect } from 'react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Segmented from '../components/ui/Segmented';
import CurrencyInput from '../components/ui/CurrencyInput';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
export default function AddTransaction() {
  const [mode, setMode] = useState(() => localStorage.getItem('add_mode') || 'expense');
  const [advanced, setAdvanced] = useState(() => localStorage.getItem('add_advanced') === 'true');
  useEffect(() => {
    localStorage.setItem('add_mode', mode);
  }, [mode]);
  useEffect(() => {
    localStorage.setItem('add_advanced', advanced ? 'true' : 'false');
  }, [advanced]);

  return (
    <Page>
      <PageHeader title="Tambah Transaksi" description="Catat pemasukan, pengeluaran dan lainnya" />
      <Section first>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { label: 'Expense', value: 'expense' },
                { label: 'Income', value: 'income' },
                { label: 'Transfer', value: 'transfer' },
                { label: 'Split', value: 'split' },
                { label: 'Recurring', value: 'recurring' },
              ]}
            />
            <Segmented
              value={advanced ? 'advanced' : 'quick'}
              onChange={(v) => setAdvanced(v === 'advanced')}
              options={[
                { label: 'Quick', value: 'quick' },
                { label: 'Advanced', value: 'advanced' },
              ]}
            />
          </div>

          {advanced ? <AdvancedForm /> : <QuickForm />}
        </div>
      </Section>
    </Page>
  );
}

function QuickForm() {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  return (
    <form className="space-y-3">
      <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
      <Select label="Kategori" value={category} onChange={(e) => setCategory(e.target.value)} options={['Umum']} />
      <Input type="date" label="Tanggal" value={date} onChange={(e) => setDate(e.target.value)} />
      <Textarea label="Catatan" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">Simpan</button>
        <button type="button" className="btn">Batal</button>
      </div>
    </form>
  );
}

function AdvancedForm() {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');

  return (
    <form className="space-y-3">
      <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Akun" value={account} onChange={(e) => setAccount(e.target.value)} options={['Cash']} />
        <Select label="Kategori" value={category} onChange={(e) => setCategory(e.target.value)} options={['Umum']} />
      </div>
      <Input type="date" label="Tanggal" value={date} onChange={(e) => setDate(e.target.value)} />
      <Input label="Merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      <Textarea label="Catatan" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">Simpan</button>
        <button type="button" className="btn">Batal</button>
      </div>
    </form>
  );
}

