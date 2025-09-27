import { useState, useEffect } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Scissors,
  CalendarClock,
  Coffee,
  UtensilsCrossed,
  Bus,
  Wallet,
} from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Card, { CardBody } from '../components/Card';
import Segmented from '../components/ui/Segmented';
import CurrencyInput from '../components/ui/CurrencyInput';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { formatCurrency } from '../lib/format';

const CATEGORY_OPTIONS = ['Umum', 'Makanan & Minuman', 'Transportasi', 'Gaji', 'Tagihan', 'Hiburan'];
const ACCOUNT_OPTIONS = ['Cash', 'BCA', 'BNI', 'BRI', 'E-Wallet'];

const TRANSACTION_TEMPLATES = [
  {
    id: 'daily-lunch',
    name: 'Makan Siang Kantor',
    description: 'Pengeluaran harian makan siang',
    amount: 35000,
    category: 'Makanan & Minuman',
    note: 'Makan siang di kantin',
    mode: 'expense',
    Icon: UtensilsCrossed,
  },
  {
    id: 'morning-coffee',
    name: 'Ngopi Pagi',
    description: 'Kopi sebelum mulai bekerja',
    amount: 25000,
    category: 'Makanan & Minuman',
    note: 'Kopi susu favorit',
    mode: 'expense',
    Icon: Coffee,
  },
  {
    id: 'commute',
    name: 'Transportasi Harian',
    description: 'Ongkos pulang-pergi kerja',
    amount: 15000,
    category: 'Transportasi',
    note: 'TransJakarta / MRT',
    mode: 'expense',
    Icon: Bus,
  },
  {
    id: 'salary',
    name: 'Gaji Bulanan',
    description: 'Pencatatan pemasukan gaji',
    amount: 8000000,
    category: 'Gaji',
    note: 'Gaji bulan ini',
    mode: 'income',
    account: 'BCA',
    Icon: Wallet,
  },
];

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
export default function AddTransaction() {
  const [mode, setMode] = useState(() => localStorage.getItem('add_mode') || 'expense');
  const [advanced, setAdvanced] = useState(() => localStorage.getItem('add_advanced') === 'true');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    localStorage.setItem('add_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('add_advanced', advanced ? 'true' : 'false');
  }, [advanced]);

  const handleTemplateSelect = (template) => {
    if (!template) return;
    setMode(template.mode || 'expense');
    setSelectedTemplate({ ...template, appliedAt: Date.now() });
  };

  return (
    <Page>
      <PageHeader title="Tambah Transaksi" description="Catat pemasukan, pengeluaran dan lainnya" />
      <Section first className="max-w-2xl mx-auto">
        <div className="space-y-6">
          <TransactionTemplates
            templates={TRANSACTION_TEMPLATES}
            onSelect={handleTemplateSelect}
            activeId={selectedTemplate?.id}
          />

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

          {advanced ? (
            <AdvancedForm template={selectedTemplate} categoryOptions={CATEGORY_OPTIONS} accountOptions={ACCOUNT_OPTIONS} />
          ) : (
            <QuickForm template={selectedTemplate} categoryOptions={CATEGORY_OPTIONS} />
          )}
        </div>
      </Section>
    </Page>
  );
}

function TransactionTemplates({ templates, onSelect, activeId }) {
  if (!templates?.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-muted">Template Transaksi</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => {
          const Icon = template.Icon;
          const isActive = activeId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? 'border-primary/80 bg-primary/5 text-text'
                  : 'border-border-subtle text-text hover:border-primary/60 hover:bg-muted/30'
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-semibold">{template.name}</span>
                <span className="block text-xs text-muted">{template.description}</span>
                {typeof template.amount === 'number' ? (
                  <span className="block text-xs font-semibold text-primary">
                    {formatCurrency(template.amount, 'IDR')}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuickForm({ template, categoryOptions }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!template) return;
    const { amount: tplAmount, category: tplCategory, date: tplDate, note: tplNote } = template;
    if (typeof tplAmount === 'number') {
      setAmount(tplAmount);
    }
    if (tplCategory) {
      setCategory(tplCategory);
    }
    setDate(tplDate || new Date().toISOString().slice(0, 10));
    setNote(tplNote || '');
  }, [template]);

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
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

function AdvancedForm({ template, categoryOptions, accountOptions }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!template) return;
    const {
      amount: tplAmount,
      category: tplCategory,
      account: tplAccount,
      merchant: tplMerchant,
      date: tplDate,
      note: tplNote,
    } = template;
    if (typeof tplAmount === 'number') {
      setAmount(tplAmount);
    }
    if (tplCategory) {
      setCategory(tplCategory);
    }
    if (tplAccount) {
      setAccount(tplAccount);
    }
    if (tplMerchant) {
      setMerchant(tplMerchant);
    }
    setDate(tplDate || new Date().toISOString().slice(0, 10));
    setNote(tplNote || '');
  }, [template]);

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
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
