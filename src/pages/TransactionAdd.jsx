import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Combobox } from '@headlessui/react';
import {
  ArrowRight,
  ArrowLeftRight,
  Banknote,
  BookmarkPlus,
  Calendar,
  FileText,
  Loader2,
  Save,
  Star,
  Tag as TagIcon,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wand2,
  X,
} from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Card, { CardBody } from '../components/Card';
import { useToast } from '../context/ToastContext';
import { createTransaction } from '../lib/transactionsApi';
import { getPrefs, updatePrefs } from '../lib/preferences';
import { formatCurrency } from '../lib/format';
import useDashboardBalances from '../hooks/useDashboardBalances';
import {
  createTransactionTemplate,
  deleteTransactionTemplate,
  listTransactionTemplates,
} from '../lib/transactionTemplatesApi';
import { useAccountsQuery, useCategoriesQuery } from '../hooks/transactionFormQueries';

const TYPE_OPTIONS = [
  {
    value: 'income',
    label: 'Income',
    description: 'Catat pemasukan',
    icon: TrendingUp,
  },
  {
    value: 'expense',
    label: 'Expense',
    description: 'Catat pengeluaran',
    icon: TrendingDown,
  },
  {
    value: 'transfer',
    label: 'Transfer',
    description: 'Pindahkan saldo antar akun',
    icon: ArrowLeftRight,
  },
];

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border border-border-subtle bg-background px-3 text-sm text-text ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

const TEXTAREA_CLASS =
  'w-full rounded-2xl border border-border-subtle bg-muted/30 px-3 py-3 text-sm text-text ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

const SEGMENTED_CLASS =
  'inline-flex rounded-2xl border border-border-subtle bg-muted/30 p-1 text-sm font-medium text-muted shadow-sm';

const SEGMENT_ITEM_CLASS =
  'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const QUICK_AMOUNT_OPTIONS = [1000, 5000, 10000, 50000, 100000, 500000];

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 });

function formatAmountInputValue(raw) {
  const digits = String(raw ?? '')
    .replace(/[^0-9]/g, '')
    .replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  const numericValue = Number.parseInt(digits, 10);
  if (!Number.isFinite(numericValue)) return '';
  return CURRENCY_FORMATTER.format(numericValue);
}

function getDateWithOffset(offset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return DATE_FORMATTER.format(date);
}

function formatAmountDisplay(value) {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `Rp ${CURRENCY_FORMATTER.format(value)}`;
}

function parseAmount(value) {
  if (typeof value === 'number') return value;
  if (!value) return NaN;
  const cleaned = String(value)
    .replace(/[^0-9,.]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(/,/g, '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export default function TransactionAdd({ onAdd }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState('expense');
  const [date, setDate] = useState(() => getDateWithOffset(0));
  const [amountInput, setAmountInput] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [errors, setErrors] = useState({});
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [applyingTemplateId, setApplyingTemplateId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [favoriteTemplateIds, setFavoriteTemplateIds] = useState(() => {
    if (typeof window === 'undefined') return [];
    const stored = window.localStorage.getItem('favorite_transaction_templates');
    if (!stored) return [];
    return stored
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  });
  const [stayOnAddAfterSave, setStayOnAddAfterSave] = useState(
    () => getPrefs().stayOnAddAfterSave,
  );

  const categoryTypes = useMemo(() => ['expense', 'income'], []);

  const categoriesQuery = useCategoriesQuery(categoryTypes);
  const categories = categoriesQuery.data ?? [];
  const categoriesLoading = categoriesQuery.isLoading;
  const categoriesError = categoriesQuery.error;

  const balanceRange = useMemo(() => {
    const today = getDateWithOffset(0);
    return { start: today, end: today };
  }, []);
  const {
    cashBalance,
    nonCashBalance,
    loading: balancesLoading,
    error: balancesError,
    refresh: refreshBalances,
  } = useDashboardBalances(balanceRange);

  const accountsQuery = useAccountsQuery();
  const accountsLoading = accountsQuery.isLoading;
  const accountsError = accountsQuery.error;

  useEffect(() => {
    if (!Array.isArray(accountsQuery.data)) return;
    setAccounts(accountsQuery.data);
  }, [accountsQuery.data]);

  const accountButtonRef = useRef(null);
  const categoryButtonRef = useRef(null);

  useEffect(() => {
    if (accountsError) {
      addToast(accountsError?.message || 'Gagal memuat master data', 'error');
    }
  }, [accountsError, addToast]);

  useEffect(() => {
    if (!accountId && accounts.length) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const records = await listTransactionTemplates();
      setTemplates(records);
    } catch (err) {
      const message = err?.message || 'Gagal memuat template transaksi';
      setTemplates([]);
      addToast(message, 'error');
    } finally {
      setTemplatesLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    refreshBalances(balanceRange);
  }, [balanceRange, refreshBalances]);

  useEffect(() => {
    if (type !== 'transfer') {
      setToAccountId('');
    } else {
      setCategoryId('');
    }
  }, [type]);

  useEffect(() => {
    if (type !== 'transfer') return;
    if (toAccountId && toAccountId === accountId) {
      setToAccountId('');
    }
  }, [accountId, toAccountId, type]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        navigate('/transactions');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [navigate]);

  const categoriesByType = useMemo(() => {
    const grouped = { income: [], expense: [] };
    categories.forEach((item) => {
      const key = (item.type || 'expense').toLowerCase();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
  }, [categories]);

  const filteredCategories = useMemo(() => {
    return categoriesByType[type] || [];
  }, [categoriesByType, type]);

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ value: account.id, label: account.name || 'Tanpa nama' })),
    [accounts],
  );

  const categoryOptions = useMemo(
    () => filteredCategories.map((category) => ({ value: category.id, label: category.name })),
    [filteredCategories],
  );

  const selectedAccountOption = useMemo(
    () => accountOptions.find((option) => option.value === accountId) || null,
    [accountOptions, accountId],
  );

  const selectedCategoryOption = useMemo(
    () => categoryOptions.find((option) => option.value === categoryId) || null,
    [categoryOptions, categoryId],
  );

  useEffect(() => {
    if (type === 'transfer') return;
    const list = categoriesByType[type] || [];
    if (!list.length) return;
    if (!categoryId || !list.some((item) => item.id === categoryId)) {
      setCategoryId(list[0].id);
    }
  }, [categoriesByType, categoryId, type]);

  const selectedAccount = accounts.find((item) => item.id === accountId);
  const availableBalanceLabel = useMemo(() => {
    if (balancesLoading) return 'Memuat...';
    const isCashAccount = selectedAccount?.type === 'cash';
    const balanceValue = isCashAccount ? cashBalance : nonCashBalance;
    return formatCurrency(balanceValue ?? 0, 'IDR');
  }, [balancesLoading, cashBalance, nonCashBalance, selectedAccount?.type]);
  const selectedToAccount = accounts.find((item) => item.id === toAccountId);
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const selectedCategoryName = selectedCategory?.name || '';
  const typeMeta = useMemo(
    () => TYPE_OPTIONS.find((option) => option.value === type),
    [type],
  );
  const typeBadgeClass =
    type === 'income'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
      : type === 'transfer'
        ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200'
        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200';
  const sortedTemplates = useMemo(() => {
    if (!templates.length) return [];
    const favorites = new Set(favoriteTemplateIds);
    return [...templates].sort((a, b) => {
      const favoriteDiff = Number(favorites.has(b.id)) - Number(favorites.has(a.id));
      if (favoriteDiff !== 0) return favoriteDiff;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [templates, favoriteTemplateIds]);

  const isTransfer = type === 'transfer';
  const amountValue = parseAmount(amountInput);
  const isAmountValid = Number.isFinite(amountValue) && amountValue > 0;
  const trimmedTitle = title.trim();
  const trimmedNotes = notes.trim();
  const notesPreview = trimmedNotes
    ? trimmedNotes.length > 80
      ? `${trimmedNotes.slice(0, 77)}…`
      : trimmedNotes
    : 'Tidak ada catatan';
  const typeDescription =
    type === 'income'
      ? 'Dana masuk ke akun sumber'
      : type === 'transfer'
        ? 'Memindahkan saldo antar akun'
        : 'Dana keluar dari akun sumber';
  const typeLabel = typeMeta?.label || 'Expense';
  const TypeIcon = typeMeta?.icon || TrendingDown;
  const categoryLabel = !isTransfer ? selectedCategory?.name || 'Belum dipilih' : null;
  const toAccountLabel = isTransfer ? selectedToAccount?.name || 'Belum dipilih' : null;
  const notesDescription = trimmedNotes ? `Catatan: ${notesPreview}` : 'Catatan belum diisi';

  const handleAmountChange = (event) => {
    const formatted = formatAmountInputValue(event.target.value);
    setAmountInput(formatted);
    setErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const handleQuickAmountSelect = (value) => {
    const currentAmount = Number.isFinite(amountValue) ? amountValue : 0;
    const nextAmount = currentAmount + value;
    setAmountInput(formatAmountInputValue(nextAmount));
    setErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const handleDateSelect = (value) => {
    setDate(value);
    setErrors((prev) => ({ ...prev, date: undefined }));
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      addToast('Nama template wajib diisi.', 'error');
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      addToast('Nominal harus diisi sebelum membuat template.', 'error');
      return;
    }
    if (!accountId) {
      addToast('Pilih akun sumber untuk template.', 'error');
      return;
    }
    if (type === 'transfer' && !toAccountId) {
      addToast('Pilih akun tujuan untuk template transfer.', 'error');
      return;
    }
    if (type === 'expense' && !categoryId) {
      addToast('Pilih kategori untuk template pengeluaran.', 'error');
      return;
    }
    setSavingTemplate(true);
    try {
      await createTransactionTemplate({
        name,
        type,
        amount: amountValue,
        account_id: accountId,
        to_account_id: type === 'transfer' ? toAccountId || null : null,
        category_id: type === 'transfer' ? null : categoryId || null,
        title: trimmedTitle || null,
        notes: trimmedNotes || null,
      });
      setTemplateName('');
      addToast('Template transaksi tersimpan.', 'success');
      await loadTemplates();
    } catch (err) {
      addToast(err?.message || 'Gagal menyimpan template transaksi.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleToggleFavoriteTemplate = (templateId) => {
    setFavoriteTemplateIds((prev) => {
      const next = prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('favorite_transaction_templates', next.join(','));
      }
      return next;
    });
  };

  const handleApplyTemplate = async (template) => {
    if (!template || applyingTemplateId) return;

    const amountValid = Number.isFinite(template.amount) && template.amount > 0;
    if (!amountValid) {
      addToast('Nominal pada template tidak valid.', 'error');
      return;
    }

    const sourceAccount = accounts.find((item) => item.id === template.account_id);
    if (!sourceAccount) {
      addToast('Akun pada template tidak ditemukan.', 'error');
      return;
    }

    let targetAccount = null;
    if (template.type === 'transfer') {
      if (!template.to_account_id) {
        addToast('Template transfer membutuhkan akun tujuan.', 'error');
        return;
      }
      targetAccount = accounts.find((item) => item.id === template.to_account_id);
      if (!targetAccount) {
        addToast('Akun tujuan pada template tidak ditemukan.', 'error');
        return;
      }
    }

    let category = null;
    if (template.type !== 'transfer') {
      if (template.type === 'expense' && !template.category_id) {
        addToast('Template pengeluaran membutuhkan kategori.', 'error');
        return;
      }
      if (template.category_id) {
        category = categories.find((item) => item.id === template.category_id);
        if (!category) {
          addToast('Kategori pada template tidak ditemukan.', 'error');
          return;
        }
      }
    }

    const trimmedTemplateTitle = template.title?.trim() || '';
    const trimmedTemplateNotes = template.notes?.trim() || '';
    const transactionDate = date || getDateWithOffset(0);

    setApplyingTemplateId(template.id);
    try {
      const saved = await createTransaction({
        type: template.type,
        date: transactionDate,
        amount: template.amount,
        account_id: template.account_id,
        to_account_id: template.type === 'transfer' ? template.to_account_id : null,
        category_id: template.type !== 'transfer' ? template.category_id || null : null,
        title: trimmedTemplateTitle ? trimmedTemplateTitle : null,
        notes: trimmedTemplateNotes ? trimmedTemplateNotes : null,
      });

      const timestamp = new Date().toISOString();
      const payload = {
        ...saved,
        amount: saved.amount ?? template.amount,
        account: sourceAccount?.name || null,
        account_id: saved.account_id ?? template.account_id,
        to_account: template.type === 'transfer' ? targetAccount?.name || null : null,
        to_account_id:
          saved.to_account_id ?? (template.type === 'transfer' ? template.to_account_id : null),
        category: template.type !== 'transfer' ? category?.name || null : null,
        category_id:
          saved.category_id ?? (template.type !== 'transfer' ? template.category_id || null : null),
        title: saved.title ?? (trimmedTemplateTitle || null),
        notes: saved.notes ?? (trimmedTemplateNotes || null),
        note: saved.notes ?? (trimmedTemplateNotes || null),
        receipt_url: saved.receipt_url || null,
        inserted_at: saved.inserted_at ?? timestamp,
        updated_at: saved.updated_at ?? timestamp,
        __persisted: true,
      };

      onAdd?.(payload);
      addToast('Transaksi dibuat dari template.', 'success');
      navigate('/transactions', { state: { recentTransaction: payload } });
    } catch (err) {
      addToast(err?.message || 'Gagal membuat transaksi dari template.', 'error');
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!id) return;
    setDeletingTemplateId(id);
    try {
      await deleteTransactionTemplate(id);
      addToast('Template transaksi dihapus.', 'success');
      await loadTemplates();
    } catch (err) {
      addToast(err?.message || 'Gagal menghapus template transaksi.', 'error');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const validate = useCallback(() => {
    const nextErrors = {};
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      nextErrors.amount = 'Nominal wajib diisi dan harus lebih besar dari 0.';
    }
    if (!date) {
      nextErrors.date = 'Pilih tanggal transaksi.';
    }
    if (!accountId) {
      nextErrors.account_id = 'Pilih akun sumber.';
    }
    if (isTransfer) {
      if (!toAccountId) {
        nextErrors.to_account_id = 'Pilih akun tujuan untuk transfer.';
      } else if (toAccountId === accountId) {
        nextErrors.to_account_id = 'Akun tujuan tidak boleh sama dengan sumber.';
      }
    } else if (toAccountId) {
      nextErrors.to_account_id = 'Akun tujuan hanya digunakan untuk transfer.';
    }
    if (!isTransfer && type === 'expense' && !categoryId) {
      nextErrors.category_id = 'Kategori wajib diisi untuk pengeluaran.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [amountValue, date, accountId, toAccountId, isTransfer, type, categoryId]);

  const handleReset = () => {
    setType('expense');
    setDate(getDateWithOffset(0));
    setAmountInput('');
    setCategoryId('');
    setTitle('');
    setNotes('');
    setErrors({});
    if (accounts.length) {
      setAccountId(accounts[0].id);
    }
    setToAccountId('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const isValid = validate();
    if (!isValid) {
      addToast('Periksa kembali data yang wajib diisi.', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = await createTransaction({
        type,
        date,
        amount: amountValue,
        account_id: accountId,
        to_account_id: isTransfer ? toAccountId : null,
        category_id: !isTransfer ? categoryId || null : null,
        title: trimmedTitle ? trimmedTitle : null,
        notes: trimmedNotes ? trimmedNotes : null,
      });

      const timestamp = new Date().toISOString();
      const payload = {
        ...saved,
        amount: saved.amount ?? amountValue,
        account: selectedAccount?.name || null,
        account_id: saved.account_id ?? accountId,
        to_account: isTransfer ? selectedToAccount?.name || null : null,
        to_account_id: saved.to_account_id ?? (isTransfer ? toAccountId : null),
        category: !isTransfer ? selectedCategory?.name || null : null,
        category_id: saved.category_id ?? (!isTransfer ? categoryId || null : null),
        title: saved.title ?? (trimmedTitle || null),
        notes: saved.notes ?? (trimmedNotes || null),
        note: saved.notes ?? (trimmedNotes || null),
        receipt_url: saved.receipt_url || null,
        inserted_at: saved.inserted_at ?? timestamp,
        updated_at: saved.updated_at ?? timestamp,
        __persisted: true,
      };

      onAdd?.(payload);
      addToast('Transaksi tersimpan', 'success');

      if (stayOnAddAfterSave) {
        handleReset();
      } else {
        navigate('/transactions', { state: { recentTransaction: payload } });
      }
    } catch (err) {
      addToast(err?.message || 'Gagal menyimpan transaksi', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Tambah Transaksi">
        <button
          type="button"
          onClick={() => navigate('/transactions')}
          className="h-11 rounded-2xl border border-border-subtle px-4 text-sm font-medium text-text transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="h-11 rounded-2xl border border-border-subtle px-4 text-sm font-medium text-text transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Reset
        </button>
        <button
          type="submit"
          form="add-transaction-form"
          disabled={saving || !isAmountValid}
          className="flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Simpan Transaksi
        </button>
      </PageHeader>

      <Section first>
        <form
          id="add-transaction-form"
          onSubmit={handleSubmit}
          className="grid gap-6 md:grid-cols-[minmax(0,1fr)_360px]"
        >
          <div className="space-y-6">
            <Card className="rounded-2xl border bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
              <CardBody className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text">Informasi dasar</p>
                      <p className="text-xs text-muted">Pilih tipe transaksi dan tanggal pencatatan.</p>
                    </div>
                    <span className="hidden rounded-full border border-border-subtle px-3 py-1 text-[11px] font-semibold text-muted md:inline-flex">
                      Step 1/4
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-muted/20 p-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tipe</span>
                      <div className="mt-2">
                        <div className={SEGMENTED_CLASS} role="radiogroup" aria-label="Pilih tipe transaksi">
                          {TYPE_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const active = type === option.value;
                            const activeClass =
                              option.value === 'income'
                                ? 'bg-emerald-500/90 text-white shadow-md shadow-emerald-500/30'
                                : option.value === 'transfer'
                                  ? 'bg-blue-500/90 text-white shadow-md shadow-blue-500/30'
                                  : 'bg-rose-500/90 text-white shadow-md shadow-rose-500/30';
                            return (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                tabIndex={active ? 0 : -1}
                                onClick={() => {
                                  setType(option.value);
                                  setErrors((prev) => ({
                                    ...prev,
                                    category_id: undefined,
                                    to_account_id: undefined,
                                  }));
                                }}
                                className={`${SEGMENT_ITEM_CLASS} ${active ? activeClass : 'text-muted hover:text-text'}`}
                              >
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                <span>{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="min-w-[200px]">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tanggal</span>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDateSelect(getDateWithOffset(0))}
                          className={`h-9 rounded-xl border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            date === getDateWithOffset(0)
                              ? 'border-primary bg-primary/10 text-primary shadow-sm'
                              : 'border-border-subtle text-text hover:bg-muted/30'
                          }`}
                        >
                          Hari ini
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDateSelect(getDateWithOffset(-1))}
                          className={`h-9 rounded-xl border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            date === getDateWithOffset(-1)
                              ? 'border-primary bg-primary/10 text-primary shadow-sm'
                              : 'border-border-subtle text-text hover:bg-muted/30'
                          }`}
                        >
                          Kemarin
                        </button>
                        <div className="relative">
                          <input
                            type="date"
                            value={date}
                            onChange={(event) => handleDateSelect(event.target.value)}
                            className={`${INPUT_CLASS} h-9`}
                          />
                        </div>
                      </div>
                      {errors.date ? <p className="mt-1 text-xs text-destructive">{errors.date}</p> : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-text">Nominal transaksi</p>
                    <p className="text-xs text-muted">Nominal menjadi fokus utama untuk memvalidasi transaksi.</p>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-gradient-to-br from-primary/15 via-background to-background px-4 py-5 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                    <label className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
                      <Banknote className="h-4 w-4" aria-hidden="true" />
                      Nominal
                    </label>
                    <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-background/80 px-4 py-4 ring-2 ring-transparent focus-within:ring-2 focus-within:ring-primary">
                      <span className="text-sm font-semibold text-muted">Rp</span>
                      <input
                        value={amountInput}
                        onChange={handleAmountChange}
                        onBlur={() => validate()}
                        inputMode="decimal"
                        placeholder="Contoh: 250.000"
                        className="w-full border-none bg-transparent text-3xl font-semibold tracking-tight text-text focus:outline-none"
                      />
                    </div>
                    {errors.amount ? <p className="mt-2 text-xs text-destructive">{errors.amount}</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {QUICK_AMOUNT_OPTIONS.map((value) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => handleQuickAmountSelect(value)}
                          className="rounded-full border border-border-subtle px-3 py-1.5 text-xs font-medium text-muted transition hover:-translate-y-0.5 hover:border-primary hover:text-primary hover:shadow-[0_8px_20px_rgba(59,130,246,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {`+${CURRENCY_FORMATTER.format(value)}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-text">Sumber & kategori</p>
                    <p className="text-xs text-muted">Pilih akun, kategori, atau akun tujuan jika transfer.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
                      <label htmlFor="account" className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                        <Wallet className="h-4 w-4" aria-hidden="true" />
                        Akun sumber
                      </label>
                      <Combobox
                        value={selectedAccountOption}
                        onChange={(option) => {
                          setAccountId(option?.value || '');
                          setErrors((prev) => ({ ...prev, account_id: undefined }));
                        }}
                        disabled={accountsLoading && accounts.length === 0}
                      >
                        <div className="relative">
                          <Combobox.Input
                            id="account"
                            className={`${INPUT_CLASS} pr-16`}
                            displayValue={(option) => option?.label || ''}
                            placeholder={accountsLoading && accounts.length === 0 ? 'Memuat akun...' : 'Akun sumber'}
                            aria-invalid={Boolean(errors.account_id)}
                            onClick={() => accountButtonRef.current?.click()}
                            readOnly
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                            <Combobox.Button
                              ref={accountButtonRef}
                              className="rounded-lg border border-border-subtle px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              {accountsLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                              ) : (
                                'Buka'
                              )}
                            </Combobox.Button>
                          </div>
                          <Combobox.Options className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-border-subtle bg-background p-1 text-sm shadow-lg focus:outline-none">
                            {accountOptions.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted">
                                {accountsLoading ? 'Memuat akun...' : 'Tidak ada akun'}
                              </div>
                            ) : (
                              accountOptions.map((option) => (
                                <Combobox.Option
                                  key={option.value}
                                  value={option}
                                  className={({ active }) =>
                                    `cursor-pointer rounded-xl px-3 py-2 text-sm text-text transition ${
                                      active ? 'bg-muted/60' : ''
                                    }`
                                  }
                                >
                                  {option.label}
                                </Combobox.Option>
                              ))
                            )}
                          </Combobox.Options>
                        </div>
                      </Combobox>
                      {errors.account_id ? (
                        <p className="mt-1 text-xs text-destructive">{errors.account_id}</p>
                      ) : null}
                      <div className="mt-3 space-y-1 text-xs text-muted">
                        <div className="flex items-center justify-between gap-2">
                          <span>Saldo tersedia</span>
                          <span className="font-medium text-text">{availableBalanceLabel}</span>
                        </div>
                        {balancesError ? (
                          <p className="text-xs text-destructive">Gagal memuat saldo.</p>
                        ) : null}
                      </div>
                    </div>
                    {isTransfer ? (
                      <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
                        <label
                          htmlFor="to-account"
                          className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"
                        >
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          Akun tujuan
                        </label>
                        <select
                          id="to-account"
                          value={toAccountId}
                          onChange={(event) => {
                            setToAccountId(event.target.value);
                            setErrors((prev) => ({ ...prev, to_account_id: undefined }));
                          }}
                          className={INPUT_CLASS}
                          disabled={accountsLoading && accounts.length === 0}
                        >
                          <option value="">
                            {accountsLoading && accounts.length === 0 ? 'Memuat akun...' : 'Pilih akun tujuan'}
                          </option>
                          {accounts
                            .filter((account) => account.id !== accountId)
                            .map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name || 'Tanpa nama'}
                              </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs text-muted">Pilih akun yang berbeda dari akun sumber.</p>
                        {errors.to_account_id ? (
                          <p className="mt-1 text-xs text-destructive">{errors.to_account_id}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {!isTransfer ? (
                      <div className="rounded-2xl border border-border-subtle bg-muted/20 p-4">
                        <label
                          htmlFor="category"
                          className="mb-2 flex items-center gap-2 text-sm font-medium text-muted"
                        >
                          <TagIcon className="h-4 w-4" aria-hidden="true" />
                          Kategori
                        </label>
                        <Combobox
                          value={selectedCategoryOption}
                          onChange={(option) => {
                            setCategoryId(option?.value || '');
                            setErrors((prev) => ({ ...prev, category_id: undefined }));
                          }}
                          disabled={categoriesLoading && filteredCategories.length === 0}
                        >
                          <div className="relative">
                            <Combobox.Input
                              id="category"
                              className={`${INPUT_CLASS} pr-16`}
                              displayValue={(option) => option?.label || ''}
                              placeholder="Pilih kategori"
                              aria-invalid={Boolean(errors.category_id)}
                              onClick={() => categoryButtonRef.current?.click()}
                              readOnly
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                              {selectedCategoryOption ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCategoryId('');
                                    setErrors((prev) => ({ ...prev, category_id: undefined }));
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle text-muted transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  aria-label="Bersihkan kategori"
                                  title="Bersihkan kategori"
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              ) : null}
                              <Combobox.Button
                                ref={categoryButtonRef}
                                className="rounded-lg border border-border-subtle px-2 py-1 text-[11px] font-medium text-muted transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                {categoriesLoading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                ) : (
                                  'Pilih'
                                )}
                              </Combobox.Button>
                            </div>
                            <Combobox.Options className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-border-subtle bg-background p-1 text-sm shadow-lg focus:outline-none">
                              {categoryOptions.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted">
                                  {categoriesLoading ? 'Memuat kategori...' : 'No categories found'}
                                </div>
                              ) : (
                                categoryOptions.map((option) => (
                                  <Combobox.Option
                                    key={option.value}
                                    value={option}
                                    className={({ active }) =>
                                      `cursor-pointer rounded-xl px-3 py-2 text-sm text-text transition ${
                                        active ? 'bg-muted/60' : ''
                                      }`
                                    }
                                  >
                                    {option.label}
                                  </Combobox.Option>
                                ))
                              )}
                            </Combobox.Options>
                          </div>
                        </Combobox>
                        <p className="mt-2 text-xs text-muted">
                          Kategori membantu analisis pengeluaran & pemasukan.
                        </p>
                        {errors.category_id ? (
                          <p className="mt-1 text-xs text-destructive">{errors.category_id}</p>
                        ) : categoriesError ? (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-destructive">
                            <span>{categoriesError.message || 'Gagal memuat kategori.'}</span>
                            <button
                              type="button"
                              onClick={() => {
                                void categoriesQuery.refetch();
                              }}
                              className="rounded-lg border border-destructive px-2 py-1 text-xs font-medium transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
                            >
                              Coba lagi
                            </button>
                          </div>
                        ) : (
                          <>
                            {categoriesLoading ? (
                              <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                Memuat kategori...
                              </p>
                            ) : null}
                            {!categoriesLoading && filteredCategories.length === 0 ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                                <span>
                                  {type === 'income'
                                    ? 'Belum ada kategori pemasukan.'
                                    : 'Belum ada kategori pengeluaran.'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => navigate('/categories')}
                                  className="rounded-lg border border-border-subtle px-2 py-1 text-xs font-medium text-text transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                >
                                  Tambah Kategori
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void categoriesQuery.refetch();
                                  }}
                                  className="rounded-lg border border-border-subtle px-2 py-1 text-xs font-medium text-text transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                >
                                  Refresh
                                </button>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-text">Detail tambahan</p>
                    <p className="text-xs text-muted">Opsional, tetapi membantu pencarian & laporan.</p>
                  </div>
                  <div className="grid gap-4">
                    <div>
                      <input
                        id="title"
                        aria-label="Judul (opsional)"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Contoh: Makan siang tim"
                        className={INPUT_CLASS}
                      />
                      <p className="mt-1 text-xs text-muted">Judul singkat memudahkan pencarian transaksi.</p>
                    </div>
                    <div>
                      <textarea
                        id="notes"
                        aria-label="Catatan (opsional)"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        rows={4}
                        placeholder="Catatan tambahan"
                        className={TEXTAREA_CLASS}
                      />
                      <p className="mt-1 text-xs text-muted">Tambahkan konteks supaya laporan lebih jelas.</p>
                    </div>
                  </div>
                </div>

                <label className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm text-text">
                  <span className="font-medium">Tetap di halaman tambah setelah simpan</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={stayOnAddAfterSave}
                    onChange={(event) => {
                      const nextValue = event.target.checked;
                      setStayOnAddAfterSave(nextValue);
                      updatePrefs({ stayOnAddAfterSave: nextValue });
                    }}
                  />
                </label>
              </CardBody>
            </Card>

            <Card className="rounded-2xl border bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
              <CardBody className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-text">Template transaksi</h2>
                  <p className="mt-1 text-sm text-muted">
                    Simpan pengaturan formulir favorit dan gunakan kembali kapan pun dibutuhkan.
                  </p>
                </div>
                <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-background p-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="template-name" className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                      Nama template
                    </label>
                    <input
                      id="template-name"
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      placeholder="Contoh: Langganan streaming"
                      className={INPUT_CLASS}
                      disabled={savingTemplate}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                    Simpan template
                  </button>
                </div>
                <div className="space-y-3">
                  {templatesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Memuat template...
                    </div>
                  ) : templates.length === 0 ? (
                    <p className="text-sm text-muted">
                      Belum ada template. Isi formulir di atas lalu simpan sebagai template untuk mempercepat pencatatan transaksi berikutnya.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border-subtle rounded-2xl border border-border-subtle bg-background/60">
                      {sortedTemplates.map((template) => {
                        const accountName = accounts.find((item) => item.id === template.account_id)?.name || 'Akun tidak ditemukan';
                        const toAccountName = template.to_account_id
                          ? accounts.find((item) => item.id === template.to_account_id)?.name || 'Akun tidak ditemukan'
                          : null;
                        const categoryName = template.category_id
                          ? categories.find((item) => item.id === template.category_id)?.name || 'Kategori tidak ditemukan'
                          : null;
                        const metaLabel =
                          template.type === 'transfer'
                            ? `Ke ${toAccountName || '—'}`
                            : categoryName || '—';
                        const isFavorite = favoriteTemplateIds.includes(template.id);
                        return (
                          <li
                            key={template.id}
                            className="group flex flex-col gap-3 px-4 py-3 transition hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="truncate text-sm font-semibold text-text">{template.name || 'Tanpa judul'}</p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                                <span className="inline-flex items-center gap-1">
                                  <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                  <span className="truncate">{accountName || '—'}</span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  {template.type === 'transfer' ? (
                                    <ArrowRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                  ) : (
                                    <TagIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                  )}
                                  <span className="truncate">{metaLabel}</span>
                                </span>
                                {isFavorite ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-400/20 dark:text-amber-200">
                                    <Star className="h-3 w-3" aria-hidden="true" />
                                    Favorit
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-2">
                              <span className="text-sm font-semibold text-text sm:min-w-[110px] sm:text-right">
                                {formatAmountDisplay(template.amount)}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleFavoriteTemplate(template.id)}
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                    isFavorite
                                      ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/20 dark:text-amber-200'
                                      : 'border-border-subtle text-muted hover:text-amber-600'
                                  }`}
                                  aria-label={isFavorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                                  title={isFavorite ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                                >
                                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplate(template)}
                                  disabled={Boolean(applyingTemplateId)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label="Gunakan template"
                                  title="Gunakan template"
                                >
                                  {applyingTemplateId === template.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  disabled={deletingTemplateId === template.id}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-muted transition hover:border-destructive/60 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label="Hapus template"
                                  title="Hapus template"
                                >
                                  {deletingTemplateId === template.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setPreviewOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-2xl border border-border-subtle bg-muted/30 px-4 py-3 text-sm font-semibold text-text transition hover:bg-muted/40 md:hidden"
            >
              <span>Ringkasan cepat</span>
              <span className="text-xs text-muted">{previewOpen ? 'Sembunyikan' : 'Lihat ringkasan'}</span>
            </button>
            <div className={`${previewOpen ? 'block' : 'hidden'} md:block`}>
              <Card className="rounded-2xl border border-border-subtle bg-white/30 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur dark:bg-slate-900/40 md:p-6">
                <CardBody className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-text">Ringkasan cepat</h2>
                    <p className="mt-1 text-sm text-muted">
                      Pastikan detail berikut sudah sesuai sebelum menyimpan transaksi.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border-subtle bg-background/60 p-4 text-sm text-muted">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${typeBadgeClass}`}>
                          <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          {typeLabel}
                        </span>
                        <span className="text-xs text-muted">{typeDescription}</span>
                      </div>
                      <div className="rounded-2xl bg-primary/10 px-4 py-2 text-right">
                        <p className="text-xs text-primary">Nominal transaksi</p>
                        <p className="text-lg font-semibold text-text">{formatAmountDisplay(amountValue)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-muted">
                    <div className="flex items-start gap-3">
                      <Calendar className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-text">{date}</p>
                        <p className="text-xs text-muted">Tanggal disimpan di zona waktu Asia/Jakarta</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Wallet className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-text">{selectedAccount?.name || 'Belum dipilih'}</p>
                        <p className="text-xs text-muted">Saldo akan bergerak dari akun ini</p>
                      </div>
                    </div>
                    {isTransfer ? (
                      <div className="flex items-start gap-3">
                        <ArrowRight className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                        <div>
                          <p className="font-medium text-text">{toAccountLabel}</p>
                          <p className="text-xs text-muted">Saldo akan diterima oleh akun tujuan</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <TagIcon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                        <div>
                          <p className="font-medium text-text">{categoryLabel}</p>
                          <p className="text-xs text-muted">Kategori membantu analisis transaksi</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-text">{trimmedTitle || 'Belum ada judul'}</p>
                        <p className="text-xs text-muted">{notesDescription}</p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </form>
      </Section>
    </Page>
  );
}
