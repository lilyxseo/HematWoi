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
import { listAccounts, listCategories } from '../lib/api';

/**
 * Quick + advanced add transaction form with mode tabs.
 * Currently implements minimal fields and persists last selected mode.
 */
export default function AddTransaction() {
  const [mode, setMode] = useState(() => localStorage.getItem('add_mode') || 'expense');
  const [advanced, setAdvanced] = useState(() => localStorage.getItem('add_advanced') === 'true');
  const [loadingMasterData, setLoadingMasterData] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    localStorage.setItem('add_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('add_advanced', advanced ? 'true' : 'false');
  }, [advanced]);

  useEffect(() => {
    let active = true;

    async function loadMasterData() {
      setLoadingMasterData(true);
      setLoadError('');
      try {
        const [accountRows, expenseRows, incomeRows] = await Promise.all([
          listAccounts(),
          listCategories('expense'),
          listCategories('income'),
        ]);
        if (!active) return;
        setAccounts(Array.isArray(accountRows) ? accountRows.filter(Boolean) : []);
        setCategories({
          expense: Array.isArray(expenseRows) ? expenseRows.filter(Boolean) : [],
          income: Array.isArray(incomeRows) ? incomeRows.filter(Boolean) : [],
        });
      } catch (error) {
        if (!active) return;
        console.error(error);
        setLoadError(error?.message || 'Gagal memuat data referensi');
        setAccounts([]);
        setCategories({ expense: [], income: [] });
      } finally {
        if (active) {
          setLoadingMasterData(false);
        }
      }
    }

    loadMasterData();

    return () => {
      active = false;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const list = categories[mode] || [];
    return list.map((category) => ({
      value: category.id,
      label: category.name || '(Tanpa nama)',
    }));
  }, [categories, mode]);

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ value: account.id, label: account.name || '(Tanpa nama)' })),
    [accounts],
  );

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

          {loadError ? <p className="text-sm text-danger">{loadError}</p> : null}

          {advanced ? (
            <AdvancedForm
              key={`advanced-${mode}`}
              categoryOptions={categoryOptions}
              accountOptions={accountOptions}
              loading={loadingMasterData}
            />
          ) : (
            <QuickForm key={`quick-${mode}`} categoryOptions={categoryOptions} loading={loadingMasterData} />
          )}
        </div>
      </Section>
    </Page>
  );
}

function QuickForm({ categoryOptions, loading }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!categoryOptions.length) {
      if (category) setCategory('');
      return;
    }
    const exists = categoryOptions.some((option) => option.value === category);
    if (!exists) {
      setCategory(categoryOptions[0].value);
    }
  }, [categoryOptions, category]);

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
            disabled={loading || !categoryOptions.length}
            placeholder={loading ? 'Memuat...' : 'Pilih kategori'}
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

function AdvancedForm({ categoryOptions, accountOptions, loading }) {
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!accountOptions.length) {
      if (account) setAccount('');
    } else if (!accountOptions.some((option) => option.value === account)) {
      setAccount(accountOptions[0].value);
    }
  }, [accountOptions, account]);

  useEffect(() => {
    if (!categoryOptions.length) {
      if (category) setCategory('');
    } else if (!categoryOptions.some((option) => option.value === category)) {
      setCategory(categoryOptions[0].value);
    }
  }, [categoryOptions, category]);

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
              disabled={loading || !accountOptions.length}
              placeholder={loading ? 'Memuat...' : 'Pilih akun'}
            />
            <Select
              label="Kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categoryOptions}
              disabled={loading || !categoryOptions.length}
              placeholder={loading ? 'Memuat...' : 'Pilih kategori'}
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
