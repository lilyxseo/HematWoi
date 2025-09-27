import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeftRight,
  Banknote,
  Calendar,
  FileText,
  Loader2,
  Receipt,
  RotateCcw,
  Save,
  Tag as TagIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Card, { CardBody } from '../components/Card';
import { useToast } from '../context/ToastContext';
import { listAccounts, listCategories } from '../lib/api';
import { listCategoriesExpense } from '../lib/budgetApi';
import { createTransaction } from '../lib/transactionsApi';
import { supabase } from '../lib/supabase';
import {
  createTransactionTemplate,
  deleteTransactionTemplate,
  listTransactionTemplates,
} from '../lib/transactionTemplatesApi';

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
  'h-11 w-full rounded-2xl border bg-background px-3 text-sm text-text ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

const TEXTAREA_CLASS =
  'w-full rounded-2xl border bg-background px-3 py-3 text-sm text-text ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60';

const SEGMENTED_CLASS =
  'inline-flex rounded-2xl border border-border-subtle bg-muted/40 p-1 text-sm font-medium text-muted';

const SEGMENT_ITEM_CLASS =
  'flex items-center gap-2 rounded-xl px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const QUICK_AMOUNT_OPTIONS = [50000, 100000, 200000, 500000];

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 });

function getDateWithOffset(offset = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return DATE_FORMATTER.format(date);
}

function formatAmountDisplay(value) {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `Rp ${CURRENCY_FORMATTER.format(value)}`;
}

function formatAmountInput(value) {
  if (value == null) return '';
  const stringValue = String(value);
  const cleaned = stringValue.replace(/[^0-9,]/g, '');
  if (!cleaned) return '';
  const [integerPartRaw, decimalPartRaw] = cleaned.split(',');
  const integerPart = integerPartRaw ? integerPartRaw.replace(/^0+(?=\d)/, '') || '0' : '0';
  const formattedInteger = integerPart ? CURRENCY_FORMATTER.format(Number(integerPart)) : '';
  if (decimalPartRaw !== undefined) {
    return `${formattedInteger}${decimalPartRaw ? `,${decimalPartRaw}` : ','}`;
  }
  return formattedInteger;
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

async function uploadReceipt(file, transactionId) {
  const path = `receipts/${transactionId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('receipts').getPublicUrl(path);
  const publicUrl = data?.publicUrl ?? null;
  if (publicUrl) {
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ receipt_url: publicUrl })
      .eq('id', transactionId);
    if (updateError) throw updateError;
  }
  return publicUrl;
}

export default function TransactionAdd({ onAdd }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
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
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateFormError, setTemplateFormError] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateDeleting, setTemplateDeleting] = useState('');

  useEffect(() => {
    let active = true;
    async function loadMasterData() {
      setLoading(true);
      try {
        const [accountRows, expenseRows, incomeRows] = await Promise.all([
          listAccounts(),
          listCategoriesExpense(),
          listCategories('income'),
        ]);
        if (!active) return;
        const sortedAccounts = (accountRows || []).slice().sort((a, b) => {
          return (a.name || '').localeCompare(b.name || '', 'id');
        });
        setAccounts(sortedAccounts);
        if (sortedAccounts.length) {
          setAccountId(sortedAccounts[0].id);
        }
        const combinedCategories = [
          ...(expenseRows || []),
          ...((incomeRows || []).filter(Boolean)),
        ];
        setCategories(combinedCategories);
      } catch (err) {
        addToast(err?.message || 'Gagal memuat master data', 'error');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMasterData();
    return () => {
      active = false;
    };
  }, [addToast]);

  useEffect(() => {
    if (type !== 'transfer') {
      setToAccountId('');
    } else {
      setCategoryId('');
    }
  }, [type]);

  useEffect(() => {
    let active = true;
    async function loadTemplates() {
      setTemplatesLoading(true);
      try {
        const rows = await listTransactionTemplates();
        if (!active) return;
        setTemplates(rows);
        setTemplatesError('');
      } catch (err) {
        if (!active) return;
        setTemplatesError(err?.message || 'Gagal memuat template transaksi.');
      } finally {
        if (active) setTemplatesLoading(false);
      }
    }
    loadTemplates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!receiptFile) return undefined;
    const url = URL.createObjectURL(receiptFile);
    setReceiptPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [receiptFile]);

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

  const categoryEmptyMessage = useMemo(() => {
    if (type === 'transfer') return null;
    const baseMessage = type === 'income' ? 'Belum ada kategori pemasukan' : 'Belum ada kategori pengeluaran';
    const baseList = categoriesByType[type] || [];
    if (!baseList.length) return baseMessage;
    return null;
  }, [type, categoriesByType]);

  useEffect(() => {
    if (type === 'transfer') return;
    const list = categoriesByType[type] || [];
    if (!list.length) return;
    if (!categoryId || !list.some((item) => item.id === categoryId)) {
      setCategoryId(list[0].id);
    }
  }, [categoriesByType, categoryId, type]);

  const categoriesForType = categoriesByType[type] || [];
  const selectedAccount = accounts.find((item) => item.id === accountId);
  const selectedToAccount = accounts.find((item) => item.id === toAccountId);
  const selectedCategory = categories.find((item) => item.id === categoryId);
  const typeLabelMap = useMemo(() => {
    const map = new Map();
    TYPE_OPTIONS.forEach((option) => {
      map.set(option.value, option.label);
    });
    return map;
  }, []);
  const accountNameMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((item) => {
      map.set(item.id, item.name || 'Tanpa nama');
    });
    return map;
  }, [accounts]);
  const categoryNameMap = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => {
      map.set(item.id, item.name || 'Tanpa nama');
    });
    return map;
  }, [categories]);
  const typeMeta = useMemo(
    () => TYPE_OPTIONS.find((option) => option.value === type),
    [type],
  );

  const isTransfer = type === 'transfer';
  const amountValue = parseAmount(amountInput);
  const trimmedTitle = title.trim();
  const trimmedNotes = notes.trim();
  const notesPreview = trimmedNotes
    ? trimmedNotes.length > 80
      ? `${trimmedNotes.slice(0, 77)}…`
      : trimmedNotes
    : 'Tidak ada catatan';
  const hasReceipt = Boolean(receiptFile || receiptPreview);
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
  const receiptSummary = hasReceipt ? '1 file terlampir' : 'Belum ada struk';
  const receiptDescription = hasReceipt
    ? 'Struk akan tersimpan bersama transaksi ini.'
    : 'Unggah struk untuk dokumentasi dan audit.';
  const notesDescription = trimmedNotes ? `Catatan: ${notesPreview}` : 'Catatan belum diisi';

  const handleAmountChange = (event) => {
    const value = event.target.value;
    setAmountInput(formatAmountInput(value));
    setErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const handleQuickAmountSelect = (value) => {
    setAmountInput(formatAmountInput(value));
    setErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const handleTemplateApply = (template) => {
    setType(template.type || 'expense');
    const hasAmount = typeof template.amount === 'number' && Number.isFinite(template.amount);
    setAmountInput(hasAmount ? formatAmountInput(template.amount) : '');
    setAccountId(template.account_id || '');
    setToAccountId(template.type === 'transfer' ? template.to_account_id || '' : '');
    setCategoryId(template.type !== 'transfer' ? template.category_id || '' : '');
    setTitle(template.title || '');
    setNotes(template.notes || '');
    setErrors({});
    addToast(`Template "${template.name}" diterapkan`, 'success');
  };

  const handleTemplateSubmit = async (event) => {
    event.preventDefault();
    if (templateSaving) return;
    const name = templateName.trim();
    if (!name) {
      setTemplateFormError('Nama template wajib diisi.');
      return;
    }
    setTemplateFormError('');
    setTemplateSaving(true);
    try {
      const savedTemplate = await createTransactionTemplate({
        name,
        type,
        amount: Number.isFinite(amountValue) && amountValue > 0 ? amountValue : null,
        account_id: accountId || null,
        to_account_id: isTransfer ? toAccountId || null : null,
        category_id: !isTransfer ? categoryId || null : null,
        title: trimmedTitle || null,
        notes: trimmedNotes || null,
      });
      setTemplates((prev) => [savedTemplate, ...prev]);
      setTemplateName('');
      setTemplateFormOpen(false);
      addToast('Template transaksi tersimpan', 'success');
    } catch (err) {
      addToast(err?.message || 'Gagal menyimpan template transaksi', 'error');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleTemplateDelete = async (templateId) => {
    if (!templateId || templateDeleting === templateId) return;
    setTemplateDeleting(templateId);
    try {
      await deleteTransactionTemplate(templateId);
      setTemplates((prev) => prev.filter((item) => item.id !== templateId));
      addToast('Template dihapus', 'success');
    } catch (err) {
      addToast(err?.message || 'Gagal menghapus template transaksi', 'error');
    } finally {
      setTemplateDeleting('');
    }
  };

  const handleDateSelect = (value) => {
    setDate(value);
    setErrors((prev) => ({ ...prev, date: undefined }));
  };

  const handleReceiptFiles = (files) => {
    if (!files || !files.length) return;
    const [file] = files;
    if (!file) return;
    setReceiptFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    handleReceiptFiles(event.dataTransfer.files);
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
    setReceiptFile(null);
    setReceiptPreview('');
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

      let receiptUrl = saved.receipt_url || null;
      if (receiptFile) {
        try {
          receiptUrl = await uploadReceipt(receiptFile, saved.id);
        } catch (err) {
          addToast(err?.message || 'Struk gagal diunggah, tetapi transaksi tersimpan.', 'error');
        }
      }

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
        receipt_url: receiptUrl,
        __persisted: true,
      };

      onAdd?.(payload);
      addToast('Transaksi tersimpan', 'success');
      navigate('/transactions');
    } catch (err) {
      addToast(err?.message || 'Gagal menyimpan transaksi', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <Section first className="mx-auto max-w-3xl">
          <div className="flex items-center justify-center gap-2 py-16 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Memuat formulir...
          </div>
        </Section>
      </Page>
    );
  }

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
          disabled={saving}
          className="flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Simpan
        </button>
      </PageHeader>

      <Section first>
        <form id="add-transaction-form" onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="rounded-2xl border bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
            <CardBody className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">Tipe</span>
                  <div className="mt-2">
                    <div className={SEGMENTED_CLASS} role="radiogroup" aria-label="Pilih tipe transaksi">
                      {TYPE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = type === option.value;
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
                            className={`${SEGMENT_ITEM_CLASS} ${active ? 'bg-primary text-primary-foreground' : 'text-muted'}`}
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
                          ? 'border-primary bg-primary text-primary-foreground'
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
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border-subtle text-text hover:bg-muted/30'
                      }`}
                    >
                      Kemarin
                    </button>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                      <input
                        type="date"
                        value={date}
                        onChange={(event) => handleDateSelect(event.target.value)}
                        className={`${INPUT_CLASS} pl-9`}
                      />
                    </div>
                  </div>
                  {errors.date ? <p className="mt-1 text-xs text-destructive">{errors.date}</p> : null}
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                  <Banknote className="h-4 w-4" aria-hidden="true" />
                  Nominal
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-background px-4 py-4 ring-2 ring-transparent focus-within:ring-2 focus-within:ring-primary">
                  <span className="text-sm font-semibold text-muted">Rp</span>
                  <input
                    value={amountInput}
                    onChange={handleAmountChange}
                    onBlur={() => validate()}
                    inputMode="decimal"
                    placeholder="Masukkan jumlah"
                    className="w-full border-none bg-transparent text-3xl font-bold tracking-tight text-text focus:outline-none"
                  />
                </div>
                {errors.amount ? <p className="mt-1 text-xs text-destructive">{errors.amount}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_AMOUNT_OPTIONS.map((value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => handleQuickAmountSelect(value)}
                      className="rounded-xl border border-border-subtle px-3 py-1.5 text-xs font-medium text-muted transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {`Rp ${CURRENCY_FORMATTER.format(value)}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="account" className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Akun sumber
                  </label>
                  <select
                    id="account"
                    value={accountId}
                    onChange={(event) => {
                      setAccountId(event.target.value);
                      setErrors((prev) => ({ ...prev, account_id: undefined }));
                    }}
                    className={INPUT_CLASS}
                  >
                    <option value="">Pilih akun</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name || 'Tanpa nama'}
                      </option>
                    ))}
                  </select>
                  {errors.account_id ? <p className="mt-1 text-xs text-destructive">{errors.account_id}</p> : null}
                </div>
                {isTransfer ? (
                  <div>
                    <label htmlFor="to-account" className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
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
                    >
                      <option value="">Pilih akun tujuan</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name || 'Tanpa nama'}
                        </option>
                      ))}
                    </select>
                    {errors.to_account_id ? <p className="mt-1 text-xs text-destructive">{errors.to_account_id}</p> : null}
                  </div>
                ) : null}
                {!isTransfer ? (
                  <div>
                    <label htmlFor="category" className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                      <TagIcon className="h-4 w-4" aria-hidden="true" />
                      Kategori
                    </label>
                    <select
                      id="category"
                      value={categoryId}
                      onChange={(event) => {
                        setCategoryId(event.target.value);
                        setErrors((prev) => ({ ...prev, category_id: undefined }));
                      }}
                      className={INPUT_CLASS}
                      disabled={categoriesForType.length === 0}
                    >
                      <option value="">Pilih kategori</option>
                      {categoriesForType.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {errors.category_id ? (
                      <p className="mt-1 text-xs text-destructive">{errors.category_id}</p>
                    ) : categoryEmptyMessage ? (
                      <p className="mt-1 text-xs text-muted">{categoryEmptyMessage}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <label htmlFor="title" className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                  Judul (opsional)
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Contoh: Makan siang tim"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label htmlFor="notes" className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                  Catatan (opsional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Catatan tambahan"
                  className={TEXTAREA_CLASS}
                />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
                  <Receipt className="h-4 w-4" aria-hidden="true" />
                  Upload struk (opsional)
                </p>
                <label
                  htmlFor="receipt"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center text-sm transition ${
                    dragOver ? 'border-primary bg-primary/10 text-primary' : 'border-border-subtle text-muted hover:border-primary hover:text-primary'
                  }`}
                >
                  <Receipt className="h-8 w-8" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-text">Tarik file ke sini atau klik untuk pilih</p>
                    <p className="text-xs text-muted">Mendukung gambar atau PDF</p>
                  </div>
                  <input
                    id="receipt"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => handleReceiptFiles(event.target.files)}
                    className="sr-only"
                  />
                  {receiptFile ? (
                    <p className="text-xs text-text">{receiptFile.name}</p>
                  ) : null}
                  {receiptPreview ? (
                    <img src={receiptPreview} alt="Pratinjau struk" className="mt-2 max-h-40 rounded-xl object-cover" />
                  ) : null}
                </label>
                {receiptFile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptPreview('');
                    }}
                    className="mt-2 inline-flex items-center gap-2 text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Hapus file
                  </button>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl border bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
              <CardBody className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-text">Ringkasan cepat</h2>
                  <p className="mt-1 text-sm text-muted">
                    Pastikan detail berikut sudah sesuai sebelum menyimpan transaksi.
                  </p>
                </div>
                <div className="space-y-3 text-sm text-muted">
                  <div className="flex items-start gap-3">
                    <TypeIcon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-text">{typeLabel}</p>
                      <p className="text-xs text-muted">{typeDescription}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Banknote className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-text">{formatAmountDisplay(amountValue)}</p>
                      <p className="text-xs text-muted">Nominal transaksi</p>
                    </div>
                  </div>
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
                  <div className="flex items-start gap-3">
                    <Receipt className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-text">{receiptSummary}</p>
                      <p className="text-xs text-muted">{receiptDescription}</p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card className="rounded-2xl border bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
              <CardBody className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-text">Template transaksi</h2>
                    <p className="mt-1 text-sm text-muted">
                      Simpan pengaturan formulir favorit dan gunakan kembali kapan saja.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (templateFormOpen) {
                        setTemplateFormOpen(false);
                        setTemplateName('');
                        setTemplateFormError('');
                      } else {
                        setTemplateName(trimmedTitle || '');
                        setTemplateFormError('');
                        setTemplateFormOpen(true);
                      }
                    }}
                    className="rounded-xl border border-border-subtle px-3 py-1.5 text-xs font-medium text-text transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {templateFormOpen ? 'Batal' : 'Buat template'}
                  </button>
                </div>

                {templateFormOpen ? (
                  <form
                    onSubmit={handleTemplateSubmit}
                    className="space-y-3 rounded-2xl border border-border-subtle bg-muted/30 p-4"
                  >
                    <div>
                      <label htmlFor="template-name" className="mb-2 block text-sm font-medium text-muted">
                        Nama template
                      </label>
                      <input
                        id="template-name"
                        value={templateName}
                        onChange={(event) => setTemplateName(event.target.value)}
                        placeholder="Contoh: Langganan Spotify"
                        className={INPUT_CLASS}
                      />
                    </div>
                    {templateFormError ? (
                      <p className="text-xs text-destructive">{templateFormError}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={templateSaving}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {templateSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        Simpan template
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateFormOpen(false);
                          setTemplateName('');
                          setTemplateFormError('');
                        }}
                        className="text-sm text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        Batalkan
                      </button>
                    </div>
                  </form>
                ) : null}

                {templatesError ? (
                  <p className="text-xs text-destructive">{templatesError}</p>
                ) : null}

                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Memuat template...
                  </div>
                ) : templates.length ? (
                  <div className="space-y-3">
                    {templates.map((template) => {
                      const typeText = typeLabelMap.get(template.type) || 'Tidak diketahui';
                      const hasAmountValue =
                        typeof template.amount === 'number' &&
                        Number.isFinite(template.amount) &&
                        template.amount > 0;
                      const amountText = hasAmountValue
                        ? formatAmountDisplay(template.amount)
                        : 'Nominal belum diatur';
                      const detailParts = [];
                      if (template.account_id) {
                        detailParts.push(`Dari ${accountNameMap.get(template.account_id) || 'Akun'}`);
                      }
                      if (template.type === 'transfer' && template.to_account_id) {
                        detailParts.push(`Ke ${accountNameMap.get(template.to_account_id) || 'Akun tujuan'}`);
                      }
                      if (template.type !== 'transfer' && template.category_id) {
                        detailParts.push(categoryNameMap.get(template.category_id) || 'Kategori');
                      }
                      if (template.title) {
                        detailParts.push(template.title);
                      }
                      const detailText = detailParts.join(' • ');
                      return (
                        <div
                          key={template.id}
                          className="rounded-2xl border border-border-subtle bg-background/40 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-text">{template.name}</p>
                              <p className="text-xs text-muted">{`${typeText} • ${amountText}`}</p>
                              {detailText ? (
                                <p className="text-xs text-muted">{detailText}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleTemplateApply(template)}
                                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                Gunakan
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTemplateDelete(template.id)}
                                disabled={templateDeleting === template.id}
                                className="rounded-xl border border-border-subtle px-3 py-1.5 text-xs font-medium text-muted transition hover:border-destructive hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {templateDeleting === template.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                ) : (
                                  'Hapus'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Belum ada template tersimpan. Simpan pengaturan formulir saat ini untuk digunakan kembali.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </form>
      </Section>
    </Page>
  );
}
