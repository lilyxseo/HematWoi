// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Download,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import DataTable from '../components/data/DataTable';
import DataCardList from '../components/data/DataCardList';
import ColumnVisibility from '../components/data/ColumnVisibility';
import BulkActionsBar from '../components/data/BulkActionsBar';
import ImportModal from '../components/data/ImportModal';
import BackupRestore from '../components/data/BackupRestore';
import DedupTool from '../components/data/DedupTool';
import NormalizeCategories from '../components/data/NormalizeCategories';
import {
  listTransactions as apiListTransactions,
  bulkDeleteTransactions,
  bulkUpdateTransactions,
  exportTransactionsCSV,
  dedupeCandidates,
  computeHash,
} from '../lib/api-data';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/session';
import { useToast } from '../context/ToastContext';

const TAB_KEYS = ['transactions', 'categories', 'debts', 'goals'];
const TAB_LABELS = {
  transactions: 'Transaksi',
  categories: 'Kategori',
  debts: 'Hutang',
  goals: 'Goals',
};

const DEFAULT_FILTER = {
  q: '',
  type: 'all',
  dateFrom: '',
  dateTo: '',
  sort: 'date-desc',
  page: 1,
  pageSize: 20,
};

function buildColumns(tab: string) {
  switch (tab) {
    case 'transactions':
      return [
        { id: 'date', label: 'Tanggal', accessor: (row) => new Date(row.date).toLocaleDateString('id-ID'), sortable: true, sortField: 'date' },
        { id: 'title', label: 'Catatan', accessor: (row) => row.title || row.notes || '-', className: 'truncate' },
        { id: 'type', label: 'Tipe', accessor: (row) => row.type, className: 'capitalize' },
        { id: 'category', label: 'Kategori', accessor: (row) => row.category?.name || '-', className: 'truncate' },
        { id: 'account', label: 'Akun', accessor: (row) => row.account?.name || '-', className: 'truncate' },
        { id: 'amount', label: 'Nominal', accessor: (row) => Number(row.amount || 0).toLocaleString('id-ID'), align: 'right', sortable: true, sortField: 'amount' },
      ];
    case 'categories':
      return [
        { id: 'name', label: 'Nama', accessor: (row) => row.name, className: 'truncate', sortable: true, sortField: 'name' },
        { id: 'type', label: 'Tipe', accessor: (row) => row.type || '-', className: 'capitalize' },
        { id: 'created_at', label: 'Dibuat', accessor: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString('id-ID') : '-', sortable: true, sortField: 'created_at' },
      ];
    case 'debts':
      return [
        { id: 'title', label: 'Judul', accessor: (row) => row.title || '-', className: 'truncate' },
        { id: 'amount', label: 'Jumlah', accessor: (row) => Number(row.amount || 0).toLocaleString('id-ID'), align: 'right', sortable: true, sortField: 'amount' },
        { id: 'status', label: 'Status', accessor: (row) => row.status || '-', className: 'capitalize' },
        { id: 'due_date', label: 'Jatuh Tempo', accessor: (row) => row.due_date ? new Date(row.due_date).toLocaleDateString('id-ID') : '-', sortable: true, sortField: 'due_date' },
      ];
    case 'goals':
      return [
        { id: 'name', label: 'Nama', accessor: (row) => row.name || row.title || '-', className: 'truncate' },
        { id: 'target', label: 'Target', accessor: (row) => Number(row.target || 0).toLocaleString('id-ID'), align: 'right', sortable: true, sortField: 'target' },
        { id: 'saved', label: 'Tersimpan', accessor: (row) => Number(row.saved || 0).toLocaleString('id-ID'), align: 'right', sortable: true, sortField: 'saved' },
        { id: 'deadline', label: 'Deadline', accessor: (row) => row.deadline ? new Date(row.deadline).toLocaleDateString('id-ID') : '-', sortable: true, sortField: 'deadline' },
      ];
    default:
      return [];
  }
}

function sortOptionsFor(tab: string) {
  switch (tab) {
    case 'transactions':
      return [
        { value: 'date-desc', label: 'Tanggal terbaru' },
        { value: 'date-asc', label: 'Tanggal terlama' },
        { value: 'amount-desc', label: 'Nominal terbesar' },
        { value: 'amount-asc', label: 'Nominal terkecil' },
      ];
    case 'categories':
      return [
        { value: 'name-asc', label: 'Nama A-Z' },
        { value: 'name-desc', label: 'Nama Z-A' },
        { value: 'created_at-desc', label: 'Terbaru dibuat' },
        { value: 'created_at-asc', label: 'Terlama dibuat' },
      ];
    case 'debts':
      return [
        { value: 'due_date-asc', label: 'Jatuh tempo terdekat' },
        { value: 'due_date-desc', label: 'Jatuh tempo terjauh' },
        { value: 'amount-desc', label: 'Nominal terbesar' },
        { value: 'amount-asc', label: 'Nominal terkecil' },
      ];
    case 'goals':
      return [
        { value: 'deadline-asc', label: 'Deadline terdekat' },
        { value: 'deadline-desc', label: 'Deadline terjauh' },
        { value: 'target-desc', label: 'Target terbesar' },
        { value: 'target-asc', label: 'Target terkecil' },
        { value: 'saved-desc', label: 'Tersimpan terbanyak' },
        { value: 'saved-asc', label: 'Tersimpan tersedikit' },
      ];
    default:
      return [];
  }
}

async function fetchCategories(filter, userId) {
  let query = supabase
    .from('categories')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);
  if (filter.q) {
    query = query.ilike('name', `%${filter.q}%`);
  }
  const [sortField, sortDir] = (filter.sort || 'name-asc').split('-');
  const ascending = sortDir !== 'desc';
  const orderField = sortField === 'created_at' ? 'created_at' : 'name';
  query = query.order(orderField, { ascending });
  const from = (filter.page - 1) * filter.pageSize;
  const to = from + filter.pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data || [], total: count || 0 };
}

async function fetchDebts(filter, userId) {
  let query = supabase
    .from('debts')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);
  if (filter.q) {
    query = query.ilike('title', `%${filter.q}%`);
  }
  const [sortField, sortDir] = (filter.sort || 'due_date-desc').split('-');
  const ascending = sortDir !== 'desc';
  const orderField = sortField === 'amount' ? 'amount' : sortField === 'due_date' ? 'due_date' : 'created_at';
  query = query.order(orderField, { ascending });
  const from = (filter.page - 1) * filter.pageSize;
  const to = from + filter.pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data || [], total: count || 0 };
}

async function fetchGoals(filter, userId) {
  let query = supabase
    .from('goals')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);
  if (filter.q) {
    query = query.ilike('name', `%${filter.q}%`);
  }
  const [sortField, sortDir] = (filter.sort || 'deadline-asc').split('-');
  const ascending = sortDir !== 'desc';
  let orderField = 'created_at';
  if (sortField === 'deadline') orderField = 'deadline';
  if (sortField === 'target') orderField = 'target';
  if (sortField === 'saved') orderField = 'saved';
  query = query.order(orderField, { ascending });
  const from = (filter.page - 1) * filter.pageSize;
  const to = from + filter.pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { rows: data || [], total: count || 0 };
}

function toFilename(entity: string, extension: string) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `hematwoi-${entity}-${stamp}.${extension}`;
}

export default function DataPage() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [filters, setFilters] = useState(() => {
    const base = TAB_KEYS.reduce((acc, key) => {
      acc[key] = { ...DEFAULT_FILTER };
      return acc;
    }, {} as Record<string, typeof DEFAULT_FILTER>);
    base.categories.sort = 'name-asc';
    base.debts.sort = 'due_date-desc';
    base.goals.sort = 'deadline-asc';
    return base;
  });
  const [dataState, setDataState] = useState(() =>
    TAB_KEYS.reduce((acc, key) => {
      acc[key] = { rows: [], total: 0, loading: false, error: '' };
      return acc;
    }, {}),
  );
  const [summary, setSummary] = useState({ total: 0, income: 0, expense: 0, net: 0 });
  const [hiddenColumns, setHiddenColumns] = useState(() =>
    TAB_KEYS.reduce((acc, key) => {
      acc[key] = new Set();
      return acc;
    }, {}),
  );
  const [selectedRows, setSelectedRows] = useState(() =>
    TAB_KEYS.reduce((acc, key) => {
      acc[key] = new Set();
      return acc;
    }, {}),
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [importOpen, setImportOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [userId, setUserId] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const uid = await getCurrentUserId();
        setUserId(uid);
        if (!uid) return;
        const [catRes, accountRes] = await Promise.all([
          supabase.from('categories').select('id, name, type').eq('user_id', uid).order('name'),
          supabase.from('accounts').select('id, name').eq('user_id', uid).order('name'),
        ]);
        if (catRes.error) throw catRes.error;
        if (accountRes.error) throw accountRes.error;
        setCategories(catRes.data || []);
        setAccounts(accountRes.data || []);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[HW][data:init]', err);
        }
      }
    })();
  }, []);

  useEffect(() => {
    const currentFilter = filters[activeTab];
    let cancelled = false;
    const load = async () => {
      setDataState((prev) => ({
        ...prev,
        [activeTab]: { ...prev[activeTab], loading: true, error: '' },
      }));
      try {
        if (!userId) {
          setDataState((prev) => ({
            ...prev,
            [activeTab]: { ...prev[activeTab], rows: [], total: 0, loading: false },
          }));
          return;
        }
        let result;
        if (activeTab === 'transactions') {
          const response = await apiListTransactions(currentFilter);
          result = { rows: response.rows, total: response.total };
          setSummary({
            total: response.total,
            income: Number(response.summary?.income || 0),
            expense: Number(response.summary?.expense || 0),
            net: Number(response.summary?.net || 0),
          });
        } else if (activeTab === 'categories') {
          result = await fetchCategories(currentFilter, userId);
        } else if (activeTab === 'debts') {
          result = await fetchDebts(currentFilter, userId);
        } else if (activeTab === 'goals') {
          result = await fetchGoals(currentFilter, userId);
        }
        if (!cancelled && result) {
          setDataState((prev) => ({
            ...prev,
            [activeTab]: { ...prev[activeTab], rows: result.rows, total: result.total, loading: false, error: '' },
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setDataState((prev) => ({
            ...prev,
            [activeTab]: { ...prev[activeTab], loading: false, error: err.message || 'Gagal memuat data' },
          }));
        }
        if (import.meta.env.DEV) {
          console.error('[HW][data:load]', err);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, filters, userId]);

  useEffect(() => {
    if (activeTab !== 'transactions') return;
    const rows = dataState.transactions.rows || [];
    if (!rows.length) {
      setDuplicates([]);
      return;
    }
    try {
      setLoadingDuplicates(true);
      const groups = dedupeCandidates(rows.filter((row) => row.id));
      setDuplicates(groups);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[HW][data:dedupe-calc]', err);
      }
    } finally {
      setLoadingDuplicates(false);
    }
  }, [dataState.transactions.rows, activeTab]);

  const handleFilterChange = (tab, key, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      next[tab] = { ...next[tab], [key]: value };
      if (key !== 'page' && key !== 'pageSize') {
        next[tab].page = 1;
      }
      return next;
    });
  };

  const columns = useMemo(() => buildColumns(activeTab), [activeTab]);
  const rows = dataState[activeTab]?.rows || [];
  const total = dataState[activeTab]?.total || 0;
  const page = filters[activeTab]?.page || 1;
  const pageSize = filters[activeTab]?.pageSize || 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const selected = selectedRows[activeTab] || new Set();
  const hidden = hiddenColumns[activeTab] || new Set();

  const toggleRow = (row) => {
    setSelectedRows((prev) => {
      const copy = { ...prev };
      const next = new Set(copy[activeTab]);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      copy[activeTab] = next;
      return copy;
    });
  };

  const toggleAll = () => {
    setSelectedRows((prev) => {
      const copy = { ...prev };
      if (selected.size === rows.length) {
        copy[activeTab] = new Set();
      } else {
        copy[activeTab] = new Set(rows.map((row) => row.id));
      }
      return copy;
    });
  };

  const handleDeleteSelected = async () => {
    if (activeTab !== 'transactions' || selected.size === 0) return;
    try {
      await bulkDeleteTransactions(Array.from(selected));
      addToast({ title: 'Transaksi dihapus', status: 'success' });
      setSelectedRows((prev) => ({ ...prev, transactions: new Set() }));
      refreshCurrentTab();
    } catch (err) {
      addToast({ title: 'Gagal menghapus transaksi', status: 'error', description: err.message });
    }
  };

  const handleBulkUpdateCategory = async (categoryId: string) => {
    if (!categoryId) return;
    try {
      await bulkUpdateTransactions({ ids: Array.from(selected), patch: { category_id: categoryId } });
      addToast({ title: 'Kategori diperbarui', status: 'success' });
      refreshCurrentTab();
      setSelectedRows((prev) => ({ ...prev, transactions: new Set() }));
    } catch (err) {
      addToast({ title: 'Gagal mengubah kategori', status: 'error', description: err.message });
    }
  };

  const refreshCurrentTab = () => {
    setFilters((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab] } }));
  };

  const handleExportCSV = async () => {
    try {
      const blob = await exportTransactionsCSV(filters.transactions);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = toFilename('transactions', 'csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast({ title: 'Gagal export CSV', status: 'error', description: err.message });
    }
  };

  const handleExportJSON = async () => {
    try {
      const rows = await fetchAllTransactions(filters.transactions);
      await triggerDownloadJSON(rows, toFilename('transactions', 'json'));
    } catch (err) {
      addToast({ title: 'Gagal export JSON', status: 'error', description: err.message });
    }
  };

  const existingHashes = useMemo(() => {
    if (activeTab !== 'transactions') return new Set();
    return new Set(
      (dataState.transactions.rows || []).map((row) =>
        computeHash({ user_id: row.user_id || userId, date: row.date, amount: row.amount, title: row.title || '' }),
      ),
    );
  }, [dataState.transactions.rows, userId, activeTab]);

  const cardSummary = [
    {
      label: 'Total Transaksi',
      value: summary.total,
      icon: Database,
    },
    {
      label: 'Total Pemasukan',
      value: summary.income,
      icon: ArrowDownToLine,
    },
    {
      label: 'Total Pengeluaran',
      value: summary.expense,
      icon: ArrowUpFromLine,
    },
    {
      label: 'Saldo Terhitung',
      value: summary.net,
      icon: RefreshCw,
    },
  ];

  return (
    <main className="min-w-0 w-full px-4 md:px-6 py-5 space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardSummary.map((card) => (
          <div key={card.label} className="rounded-3xl border border-border bg-card/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <card.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {typeof card.value === 'number' ? card.value.toLocaleString('id-ID') : card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {TAB_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition ${
                activeTab === key ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setActiveTab(key)}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {activeTab === 'transactions' && (
              <>
                <button
                  type="button"
                  className="inline-flex h-[40px] items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm"
                  onClick={handleExportCSV}
                >
                  <Download className="h-4 w-4" /> CSV
                </button>
                <button
                  type="button"
                  className="inline-flex h-[40px] items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm"
                  onClick={handleExportJSON}
                >
                  <Download className="h-4 w-4" /> JSON
                </button>
                <button
                  type="button"
                  className="inline-flex h-[40px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="h-4 w-4" /> Import CSV
                </button>
              </>
            )}
            <ColumnVisibility
              columns={columns}
              hidden={hidden}
              onChange={(set) =>
                setHiddenColumns((prev) => ({
                  ...prev,
                  [activeTab]: new Set(Array.from(set).filter(Boolean)),
                }))
              }
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-8 gap-3 items-center">
          <div className="col-span-2 md:col-span-3">
            <div className="flex h-[40px] items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={filters[activeTab].q}
                onChange={(event) => handleFilterChange(activeTab, 'q', event.target.value)}
                placeholder="Cari..."
                className="h-full flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
          {activeTab === 'transactions' && (
            <>
              <select
                value={filters.transactions.type}
                onChange={(event) => handleFilterChange('transactions', 'type', event.target.value)}
                className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="all">Semua Tipe</option>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
                <option value="transfer">Transfer</option>
              </select>
              <input
                type="date"
                value={filters.transactions.dateFrom || ''}
                onChange={(event) => handleFilterChange('transactions', 'dateFrom', event.target.value)}
                className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
              <input
                type="date"
                value={filters.transactions.dateTo || ''}
                onChange={(event) => handleFilterChange('transactions', 'dateTo', event.target.value)}
                className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
            </>
          )}
          <div className="col-span-2 md:col-span-2">
            <select
              value={filters[activeTab].sort}
              onChange={(event) => handleFilterChange(activeTab, 'sort', event.target.value)}
              className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {sortOptionsFor(activeTab).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 md:col-span-1 md:ml-auto">
            <select
              value={filters[activeTab].pageSize}
              onChange={(event) => handleFilterChange(activeTab, 'pageSize', Number(event.target.value))}
              className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}/halaman
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {dataState[activeTab].error && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {dataState[activeTab].error}
            </div>
          )}
          {isMobile ? (
            <DataCardList
              rows={rows}
              columns={columns}
              hiddenColumns={hidden}
              selectedIds={selected}
              onToggleSelect={toggleRow}
              loading={dataState[activeTab].loading}
              onAction={(action, row) => {
                if (action === 'delete' && activeTab === 'transactions') {
                  bulkDeleteTransactions([row.id])
                    .then(() => {
                      addToast({ title: 'Transaksi dihapus', status: 'success' });
                      refreshCurrentTab();
                    })
                    .catch((err) => {
                      addToast({ title: 'Gagal menghapus', status: 'error', description: err.message });
                    });
                }
              }}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              hiddenColumns={hidden}
              selectedIds={selected}
              onToggleSelect={toggleRow}
              onToggleAll={toggleAll}
              sort={filters[activeTab].sort}
              onSortChange={(value) => handleFilterChange(activeTab, 'sort', value)}
              loading={dataState[activeTab].loading}
            />
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Menampilkan {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} dari {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3"
                onClick={() => handleFilterChange(activeTab, 'page', Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <span>
                {page}/{pageCount}
              </span>
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3"
                onClick={() => handleFilterChange(activeTab, 'page', Math.min(pageCount, page + 1))}
                disabled={page >= pageCount}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {activeTab === 'transactions' && selected.size > 0 && (
        <BulkActionsBar
          selectedCount={selected.size}
          categories={categories}
          onDelete={handleDeleteSelected}
          onUpdateCategory={handleBulkUpdateCategory}
          onClear={() => setSelectedRows((prev) => ({ ...prev, transactions: new Set() }))}
        />
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <DedupTool
            duplicates={duplicates}
            loading={loadingDuplicates}
            onDelete={async (ids) => {
              try {
                await bulkDeleteTransactions(ids);
                addToast({ title: 'Duplikat dihapus', status: 'success' });
                refreshCurrentTab();
              } catch (err) {
                addToast({ title: 'Gagal menghapus duplikat', status: 'error', description: err.message });
              }
            }}
            onRefresh={refreshCurrentTab}
          />
          <NormalizeCategories
            categories={categories}
            onComplete={() => {
              refreshCurrentTab();
              if (userId) {
                supabase
                  .from('categories')
                  .select('id, name, type')
                  .eq('user_id', userId)
                  .order('name')
                  .then((res) => {
                    if (!res.error) setCategories(res.data || []);
                  });
              }
            }}
          />
        </div>
      )}

      <BackupRestore
        activeTab={activeTab === 'transactions' ? 'transactions' : undefined}
        onRestoreComplete={refreshCurrentTab}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          refreshCurrentTab();
        }}
        existingCategories={categories}
        existingAccounts={accounts}
        existingHashes={existingHashes}
        userId={userId}
      />
    </main>
  );
}

async function fetchAllTransactions(filter) {
  const pageSize = 500;
  let page = 1;
  let fetched = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await apiListTransactions({ ...filter, page, pageSize });
    fetched = fetched.concat(response.rows);
    if (!response.rows.length || fetched.length >= response.total) {
      break;
    }
    page += 1;
  }
  return fetched;
}

async function triggerDownloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
