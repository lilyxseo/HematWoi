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
import { useToast } from '../context/ToastContext';
import { listCategories } from '../lib/api';

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
export default function AddTransaction() {
  const [mode, setMode] = useState(() => localStorage.getItem('add_mode') || 'expense');
  const [advanced, setAdvanced] = useState(() => localStorage.getItem('add_advanced') === 'true');
  const { addToast } = useToast() ?? {};
  const [categoryRows, setCategoryRows] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('add_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('add_advanced', advanced ? 'true' : 'false');
  }, [advanced]);

  useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        setCategoriesLoading(true);
        const rows = await listCategories();
        if (!ignore) {
          setCategoryRows(Array.isArray(rows) ? rows : []);
        }
      } catch (error) {
        console.error('Failed to load categories for AddTransaction', error);
        if (!ignore) {
          setCategoryRows([]);
          addToast?.('Gagal memuat kategori', 'error');
        }
      } finally {
        if (!ignore) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();
    return () => {
      ignore = true;
    };
  }, [addToast]);

  const categoryOptions = useMemo(() => {
    const groups = { expense: [], income: [] };
    categoryRows.forEach((row) => {
      const type = row?.type === 'income' ? 'income' : 'expense';
      if (row?.id && row?.name) {
        groups[type].push({ value: row.id, label: row.name });
      }
    });
    return groups;
  }, [categoryRows]);

  const modeCategories = useMemo(() => {
    if (mode === 'income' || mode === 'expense') {
      return categoryOptions[mode] ?? [];
    }
    return [];
  }, [mode, categoryOptions]);

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
              categoryOptions={modeCategories}
              categoriesLoading={categoriesLoading}
            />
          ) : (
            <QuickForm mode={mode} categoryOptions={modeCategories} categoriesLoading={categoriesLoading} />
          )}
        </div>
      </Section>
    </Page>
  );
}

function QuickForm({ mode, categoryOptions, categoriesLoading }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (mode !== 'income' && mode !== 'expense') {
      setCategory('');
      return;
    }
    if (categoryOptions.length === 0) {
      setCategory('');
      return;
    }
    setCategory((prev) => {
      if (prev && categoryOptions.some((opt) => opt.value === prev)) {
        return prev;
      }
      return categoryOptions[0].value;
    });
  }, [mode, categoryOptions]);

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          {mode === 'income' || mode === 'expense' ? (
            <Select
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categoryOptions}
              placeholder={categoriesLoading ? 'Memuat kategori…' : 'Pilih kategori'}
              disabled={categoriesLoading || categoryOptions.length === 0}
              helper={
                !categoriesLoading && categoryOptions.length === 0
                  ? 'Belum ada kategori untuk tipe ini'
                  : undefined
              }
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

function AdvancedForm({ mode, categoryOptions, categoriesLoading }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (mode !== 'income' && mode !== 'expense') {
      setCategory('');
      return;
    }
    if (categoryOptions.length === 0) {
      setCategory('');
      return;
    }
    setCategory((prev) => {
      if (prev && categoryOptions.some((opt) => opt.value === prev)) {
        return prev;
      }
      return categoryOptions[0].value;
    });
  }, [mode, categoryOptions]);

  return (
    <form>
      <Card>
        <CardBody className="space-y-4">
          <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Akun" value={account} onChange={(e) => setAccount(e.target.value)} options={['Cash']} />
            {mode === 'income' || mode === 'expense' ? (
              <Select
                label="Kategori"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={categoryOptions}
                placeholder={categoriesLoading ? 'Memuat kategori…' : 'Pilih kategori'}
                disabled={categoriesLoading || categoryOptions.length === 0}
                helper={
                  !categoriesLoading && categoryOptions.length === 0
                    ? 'Belum ada kategori untuk tipe ini'
                    : undefined
                }
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
