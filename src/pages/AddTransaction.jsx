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
import { useToast } from '../context/ToastContext';

const CATEGORY_GROUP_KEYS = ['expense', 'income', 'transfer', 'split', 'recurring'];

function createEmptyCategoryGroups() {
  return CATEGORY_GROUP_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

function normalizeCategoryOptions(rows = []) {
  const groups = createEmptyCategoryGroups();
  rows.forEach((row) => {
    if (!row) return;
    const rawType = String(row?.type || row?.category_type || row?.mode || '').toLowerCase();
    const groupKey = CATEGORY_GROUP_KEYS.includes(rawType) ? rawType : rawType === 'income' ? 'income' : 'expense';
    const label = row?.name || row?.label || row?.title || 'Tanpa nama';
    const valueSource = row?.id ?? row?.uuid ?? row?.slug ?? row?.key ?? label;
    const value = valueSource != null ? String(valueSource) : label;
    const order = row?.order_index ?? row?.sort_order ?? row?.order ?? 0;
    groups[groupKey].push({ value, label, order });
  });

  CATEGORY_GROUP_KEYS.forEach((key) => {
    groups[key] = groups[key]
      .sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.label.localeCompare(b.label);
      })
      .map(({ value, label }) => ({ value, label }));
  });

  return groups;
}

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
export default function AddTransaction() {
  const [mode, setMode] = useState(() => localStorage.getItem('add_mode') || 'expense');
  const [advanced, setAdvanced] = useState(() => localStorage.getItem('add_advanced') === 'true');
  const repo = useRepo();
  const { addToast } = useToast();
  const [categoryGroups, setCategoryGroups] = useState(() => createEmptyCategoryGroups());
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
        const rows = await repo.categories.list();
        if (!active) return;
        const grouped = normalizeCategoryOptions(Array.isArray(rows) ? rows : []);
        setCategoryGroups(grouped);
      } catch (err) {
        if (!active) return;
        console.error('[AddTransaction] Failed to load categories', err);
        addToast?.('Gagal memuat kategori', 'error');
        setCategoryGroups(createEmptyCategoryGroups());
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
  }, [repo, addToast]);

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
            <AdvancedForm mode={mode} categories={categoryGroups} loading={categoriesLoading} />
          ) : (
            <QuickForm mode={mode} categories={categoryGroups} loading={categoriesLoading} />
          )}
        </div>
      </Section>
    </Page>
  );
}

function QuickForm({ mode, categories, loading }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const options = useMemo(() => {
    const list = categories?.[mode];
    return Array.isArray(list) ? list : [];
  }, [categories, mode]);

  useEffect(() => {
    if (!Array.isArray(options) || options.length === 0) {
      setCategory('');
      return;
    }
    setCategory((prev) => {
      if (options.some((opt) => opt.value === prev)) return prev;
      return options[0].value;
    });
  }, [options]);

  const selectPlaceholder = loading
    ? 'Memuat kategori...'
    : options.length === 0
      ? 'Kategori tidak tersedia'
      : 'Pilih kategori';

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          <Select
            label="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={options}
            placeholder={selectPlaceholder}
            disabled={loading || options.length === 0}
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

function AdvancedForm({ mode, categories, loading }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const options = useMemo(() => {
    const list = categories?.[mode];
    return Array.isArray(list) ? list : [];
  }, [categories, mode]);

  useEffect(() => {
    if (!Array.isArray(options) || options.length === 0) {
      setCategory('');
      return;
    }
    setCategory((prev) => {
      if (options.some((opt) => opt.value === prev)) return prev;
      return options[0].value;
    });
  }, [options]);

  const selectPlaceholder = loading
    ? 'Memuat kategori...'
    : options.length === 0
      ? 'Kategori tidak tersedia'
      : 'Pilih kategori';

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
              options={options}
              placeholder={selectPlaceholder}
              disabled={loading || options.length === 0}
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
