import { useState, useEffect, useMemo } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Scissors,
  CalendarClock,
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
import { TRANSACTION_TEMPLATES } from './transactionTemplates';

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
export default function AddTransaction() {
  const [mode, setMode] = useState(() => localStorage.getItem('add_mode') || 'expense');
  const [advanced, setAdvanced] = useState(() => localStorage.getItem('add_advanced') === 'true');
  const [template, setTemplate] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  useEffect(() => {
    localStorage.setItem('add_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('add_advanced', advanced ? 'true' : 'false');
  }, [advanced]);

  const filteredTemplates = useMemo(
    () => TRANSACTION_TEMPLATES.filter((item) => item.mode === mode),
    [mode],
  );

  const handleModeChange = (value) => {
    setMode(value);
    setSelectedTemplateId(null);
    setTemplate(null);
  };

  const handleAdvancedChange = (value) => {
    setAdvanced(value === 'advanced');
    setSelectedTemplateId(null);
    setTemplate(null);
  };

  const handleTemplateSelect = (item) => {
    setSelectedTemplateId(item.id);
    if (item.mode !== mode) {
      setMode(item.mode);
    }
    if (typeof item.advanced === 'boolean') {
      setAdvanced(item.advanced);
    }
    setTemplate({ ...item, appliedAt: Date.now() });
  };

  return (
    <Page>
      <PageHeader title="Tambah Transaksi" description="Catat pemasukan, pengeluaran dan lainnya" />
      <Section first className="max-w-2xl mx-auto">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={mode}
              onChange={handleModeChange}
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
              onChange={handleAdvancedChange}
              options={[
                { label: 'Quick', value: 'quick' },
                { label: 'Advanced', value: 'advanced' },
              ]}
            />
          </div>

          {filteredTemplates.length > 0 ? (
            <Card>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Template Transaksi</p>
                  <p className="text-sm text-muted-foreground">Pilih salah satu untuk mengisi formulir secara otomatis.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredTemplates.map((item) => {
                    const Icon = item.icon;
                    const selected = item.id === selectedTemplateId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTemplateSelect(item)}
                        className={`group flex items-start gap-3 rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/40 hover:bg-muted'}`}
                        aria-pressed={selected}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-md border text-primary transition group-hover:scale-105 ${selected ? 'border-primary bg-primary/10' : 'border-transparent bg-primary/5 group-hover:bg-primary/10'}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="space-y-1">
                          <span className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{item.name}</span>
                            {item.preset?.amount ? (
                              <span className="rounded-full bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
                                {formatCurrency(item.preset.amount, 'IDR')}
                              </span>
                            ) : null}
                          </span>
                          <p className="text-sm leading-snug text-muted-foreground">{item.description}</p>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ) : null}

          {advanced ? <AdvancedForm template={template} /> : <QuickForm template={template} />}
        </div>
      </Section>
    </Page>
  );
}

function QuickForm({ template }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('Umum');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!template) return;
    const { preset } = template;
    if (preset?.amount != null) {
      setAmount(preset.amount);
    }
    if (preset?.category) {
      setCategory(preset.category);
    }
    if (preset?.note != null) {
      setNote(preset.note);
    }
    if (preset?.date) {
      setDate(preset.date);
    }
  }, [template]);

  const categoryOptions = useMemo(() => {
    const base = ['Umum', 'Makanan', 'Transportasi', 'Langganan', 'Gaji', 'Lainnya', 'Belanja'];
    if (template?.preset?.category && !base.includes(template.preset.category)) {
      return [...base, template.preset.category];
    }
    return base;
  }, [template]);

  return (
    <form className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          <Select label="Kategori" value={category} onChange={(e) => setCategory(e.target.value)} options={categoryOptions} />
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

function AdvancedForm({ template }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('Umum');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('Cash');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!template) return;
    const { preset } = template;
    if (preset?.amount != null) {
      setAmount(preset.amount);
    }
    if (preset?.category) {
      setCategory(preset.category);
    }
    if (preset?.note != null) {
      setNote(preset.note);
    }
    if (preset?.date) {
      setDate(preset.date);
    }
    if (preset?.merchant != null) {
      setMerchant(preset.merchant);
    }
    if (preset?.account) {
      setAccount(preset.account);
    }
  }, [template]);

  const categoryOptions = useMemo(() => {
    const base = ['Umum', 'Makanan', 'Transportasi', 'Langganan', 'Gaji', 'Lainnya', 'Belanja'];
    if (template?.preset?.category && !base.includes(template.preset.category)) {
      return [...base, template.preset.category];
    }
    return base;
  }, [template]);

  const accountOptions = useMemo(() => {
    const base = ['Cash', 'Rekening Bank', 'Kartu Kredit', 'E-Wallet'];
    if (template?.preset?.account && !base.includes(template.preset.account)) {
      return [...base, template.preset.account];
    }
    return base;
  }, [template]);

  return (
    <form className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Akun" value={account} onChange={(e) => setAccount(e.target.value)} options={accountOptions} />
            <Select label="Kategori" value={category} onChange={(e) => setCategory(e.target.value)} options={categoryOptions} />
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
