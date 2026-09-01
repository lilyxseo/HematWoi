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
import { useRepo } from '../context/DataContext';

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
export default function AddTransaction() {
  const [mode, setMode] = useState(() => localStorage.getItem('add_mode') || 'expense');
  const [advanced, setAdvanced] = useState(() => localStorage.getItem('add_advanced') === 'true');
  const repo = useRepo();
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    localStorage.setItem('add_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('add_advanced', advanced ? 'true' : 'false');
  }, [advanced]);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        setLoadingCategories(true);
        const list = await repo.categories.list();
        if (!active) return;
        setCategories(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error('Gagal memuat kategori', error);
        if (active) setCategories([]);
      } finally {
        if (active) setLoadingCategories(false);
      }
    }
    loadCategories();
    return () => {
      active = false;
    };
  }, [repo]);

  const categoryOptions = useMemo(() => {
    if (mode === 'transfer') return [];
    const targetType = mode === 'income' ? 'income' : 'expense';
    return categories
      .filter((cat) => (cat?.type ?? 'expense') === targetType)
      .map((cat) => ({ value: cat.id, label: cat.name || '(Tanpa kategori)' }));
  }, [categories, mode]);

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
            <AdvancedForm
              mode={mode}
              categoryOptions={categoryOptions}
              loadingCategories={loadingCategories}
            />
          ) : (
            <QuickForm
              mode={mode}
              categoryOptions={categoryOptions}
              loadingCategories={loadingCategories}
            />
          )}
        </div>
      </Section>
    </Page>
  );
}

function QuickForm({ categoryOptions, mode, loadingCategories }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!categoryOptions.length) {
      setCategory('');
      return;
    }
    setCategory((prev) => {
      const exists = categoryOptions.some((opt) => opt.value === prev);
      return exists ? prev : categoryOptions[0].value;
    });
  }, [categoryOptions]);

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
            disabled={mode === 'transfer' || categoryOptions.length === 0}
            placeholder={
              mode === 'transfer'
                ? 'Kategori tidak diperlukan'
                : loadingCategories
                ? 'Memuat kategori...'
                : categoryOptions.length === 0
                ? 'Tidak ada kategori'
                : 'Pilih kategori'
            }
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

function AdvancedForm({ categoryOptions, mode, loadingCategories }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!categoryOptions.length) {
      setCategory('');
      return;
    }
    setCategory((prev) => {
      const exists = categoryOptions.some((opt) => opt.value === prev);
      return exists ? prev : categoryOptions[0].value;
    });
  }, [categoryOptions]);

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Akun" value={account} onChange={(e) => setAccount(e.target.value)} options={['Cash']} />
            <Select
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categoryOptions}
              disabled={mode === 'transfer' || categoryOptions.length === 0}
              placeholder={
                mode === 'transfer'
                  ? 'Kategori tidak diperlukan'
                  : loadingCategories
                  ? 'Memuat kategori...'
                  : categoryOptions.length === 0
                  ? 'Tidak ada kategori'
                  : 'Pilih kategori'
              }
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
