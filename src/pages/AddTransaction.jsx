import { useState, useEffect } from 'react';
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
import { listCategories } from '../lib/api-categories';

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
export default function AddTransaction() {
  const [mode, setMode] = useState(() => localStorage.getItem('add_mode') || 'expense');
  const [advanced, setAdvanced] = useState(() => localStorage.getItem('add_advanced') === 'true');
  const [categories, setCategories] = useState({ income: [], expense: [] });
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('add_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('add_advanced', advanced ? 'true' : 'false');
  }, [advanced]);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setCategoriesLoading(true);
      try {
        const rows = await listCategories();
        if (!active) return;
        const grouped = rows.reduce(
          (acc, row) => {
            const option = { value: row.id, label: row.name };
            if (row.type === 'income') {
              acc.income.push(option);
            } else {
              acc.expense.push(option);
            }
            return acc;
          },
          { income: [], expense: [] },
        );
        setCategories(grouped);
      } catch (error) {
        console.error('Failed to load categories', error);
        if (active) {
          setCategories({ income: [], expense: [] });
        }
      } finally {
        if (active) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

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

          {advanced ? (
            <AdvancedForm mode={mode} categories={categories} categoriesLoading={categoriesLoading} />
          ) : (
            <QuickForm mode={mode} categories={categories} categoriesLoading={categoriesLoading} />
          )}
        </div>
      </Section>
    </Page>
  );
}

function QuickForm({ mode, categories, categoriesLoading }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const showCategory = mode === 'expense' || mode === 'income';
  const categoryOptions = showCategory ? categories[mode] ?? [] : [];

  useEffect(() => {
    setCategory('');
  }, [mode]);

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          {showCategory ? (
            <Select
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categoryOptions}
              placeholder={categoriesLoading ? 'Memuat kategori…' : 'Pilih kategori'}
              disabled={categoriesLoading || categoryOptions.length === 0}
            />
          ) : null}
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

function AdvancedForm({ mode, categories, categoriesLoading }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const showCategory = mode === 'expense' || mode === 'income';
  const categoryOptions = showCategory ? categories[mode] ?? [] : [];

  useEffect(() => {
    setCategory('');
  }, [mode]);

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Akun" value={account} onChange={(e) => setAccount(e.target.value)} options={['Cash']} />
            {showCategory ? (
              <Select
                label="Kategori"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={categoryOptions}
                placeholder={categoriesLoading ? 'Memuat kategori…' : 'Pilih kategori'}
                disabled={categoriesLoading || categoryOptions.length === 0}
              />
            ) : null}
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
