import { useState, useEffect, useMemo } from 'react';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Scissors, CalendarClock } from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Card, { CardBody } from '../components/Card';
import Segmented from '../components/ui/Segmented';
import CurrencyInput from '../components/ui/CurrencyInput';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
const transactionTemplates = [
  {
    id: 'lunch',
    mode: 'expense',
    name: 'Makan Siang',
    description: 'Pengeluaran makan siang kantor',
    amount: 35000,
    category: 'Makanan & Minuman',
    note: 'Makan siang kantor',
    merchant: 'Warung favorit',
    account: 'Cash',
  },
  {
    id: 'transport',
    mode: 'expense',
    name: 'Transportasi',
    description: 'Transport pulang-pergi',
    amount: 20000,
    category: 'Transportasi',
    note: 'Transport ke kantor',
    account: 'Cash',
  },
  {
    id: 'groceries',
    mode: 'expense',
    name: 'Belanja Harian',
    description: 'Belanja kebutuhan pokok mingguan',
    amount: 250000,
    category: 'Belanja Rumah Tangga',
    note: 'Belanja harian',
    account: 'Kartu Debit',
  },
  {
    id: 'salary',
    mode: 'income',
    name: 'Gaji Bulanan',
    description: 'Pemasukan gaji rutin',
    amount: 5500000,
    category: 'Gaji',
    note: 'Gaji bulan berjalan',
    account: 'Rekening Utama',
  },
  {
    id: 'freelance',
    mode: 'income',
    name: 'Proyek Freelance',
    description: 'Pendapatan proyek sampingan',
    amount: 1200000,
    category: 'Penghasilan Tambahan',
    note: 'Pembayaran proyek freelance',
    account: 'Rekening Utama',
  },
  {
    id: 'savings-transfer',
    mode: 'transfer',
    name: 'Transfer Tabungan',
    description: 'Pindahkan dana ke tabungan',
    amount: 500000,
    category: 'Transfer Internal',
    note: 'Setoran tabungan bulanan',
    account: 'Rekening Utama',
  },
];

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
      <Section first className="max-w-2xl mx-auto">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { label: (<span className="flex items-center gap-1"><ArrowDownCircle className="h-4 w-4" />Expense</span>), value: 'expense' },
                { label: (<span className="flex items-center gap-1"><ArrowUpCircle className="h-4 w-4" />Income</span>), value: 'income' },
                { label: (<span className="flex items-center gap-1"><ArrowLeftRight className="h-4 w-4" />Transfer</span>), value: 'transfer' },
                { label: (<span className="flex items-center gap-1"><Scissors className="h-4 w-4" />Split</span>), value: 'split' },
                { label: (<span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" />Recurring</span>), value: 'recurring' },
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

          {advanced ? <AdvancedForm mode={mode} /> : <QuickForm mode={mode} />}
        </div>
      </Section>
    </Page>
  );
}

function QuickForm({ mode }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const templates = useMemo(
    () => transactionTemplates.filter((tpl) => tpl.mode === mode),
    [mode],
  );
  const categoryOptions = useMemo(() => {
    const base = new Set(['Umum']);
    templates.forEach((tpl) => {
      if (tpl.category) base.add(tpl.category);
    });
    return Array.from(base);
  }, [templates]);

  const applyTemplate = (template) => {
    if (typeof template.amount === 'number') setAmount(template.amount);
    if (template.category) setCategory(template.category);
    if (template.note) setNote(template.note);
  };

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
          {templates.length ? (
            <TemplatePicker templates={templates} onSelect={applyTemplate} />
          ) : null}
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          <Select
            label="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categoryOptions}
          />
          <Input type="date" label="Tanggal" value={date} onChange={(e) => setDate(e.target.value)} />
          <Textarea label="Catatan" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="submit" className="btn btn-primary">Simpan</button>
            <button type="button" className="btn">Batal</button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

function AdvancedForm({ mode }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const templates = useMemo(
    () => transactionTemplates.filter((tpl) => tpl.mode === mode),
    [mode],
  );
  const categoryOptions = useMemo(() => {
    const base = new Set(['Umum']);
    templates.forEach((tpl) => {
      if (tpl.category) base.add(tpl.category);
    });
    return Array.from(base);
  }, [templates]);
  const accountOptions = useMemo(() => {
    const base = new Set(['Cash']);
    templates.forEach((tpl) => {
      if (tpl.account) base.add(tpl.account);
    });
    return Array.from(base);
  }, [templates]);

  const applyTemplate = (template) => {
    if (typeof template.amount === 'number') setAmount(template.amount);
    if (template.category) setCategory(template.category);
    if (template.note) setNote(template.note);
    if (template.account) setAccount(template.account);
    if (template.merchant) setMerchant(template.merchant);
  };

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
          {templates.length ? (
            <TemplatePicker templates={templates} onSelect={applyTemplate} />
          ) : null}
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Akun"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              options={accountOptions}
            />
            <Select
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categoryOptions}
            />
          </div>
          <Input type="date" label="Tanggal" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          <Textarea label="Catatan" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="submit" className="btn btn-primary">Simpan</button>
            <button type="button" className="btn">Batal</button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

function TemplatePicker({ templates, onSelect }) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text">Template transaksi</p>
        <p className="text-xs text-muted">Pilih template untuk mengisi formulir secara otomatis.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            className="group min-w-[140px] flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-left transition hover:border-primary hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="block text-sm font-semibold text-text">{template.name}</span>
            {template.description ? (
              <span className="mt-0.5 block text-xs text-muted">{template.description}</span>
            ) : null}
            {typeof template.amount === 'number' ? (
              <span className="mt-1 block text-xs font-medium text-primary">
                Rp {template.amount.toLocaleString('id-ID')}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
