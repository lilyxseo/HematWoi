import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeftRight,
  Banknote,
  BookmarkPlus,
  Calendar,
  FileText,
  Loader2,
  Receipt,
  RotateCcw,
  Save,
  Tag as TagIcon,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wand2,
} from 'lucide-react';
import Page from '../layout/Page';
import PageHeader from '../layout/PageHeader';
import Section from '../layout/Section';
import Card, { CardBody } from '../components/Card';
import { useToast } from '../context/ToastContext';
import { listAccounts, listCategories } from '../lib/api';
import { listCategoriesExpense } from '../lib/budgetApi';
import { createTransaction } from '../lib/transactionsApi';
import {
  createTransactionTemplate,
  deleteTransactionTemplate,
  listTransactionTemplates,
} from '../lib/transactionTemplatesApi';
import { supabase } from '../lib/supabase';

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
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [applyingTemplateId, setApplyingTemplateId] = useState(null);

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
        const orderedAccounts = Array.isArray(accountRows)
          ? accountRows.filter(Boolean)
          : [];
        setAccounts(orderedAccounts);
        if (orderedAccounts.length) {
          setAccountId((prev) => prev || orderedAccounts[0].id);
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

  const filteredCategories = useMemo(() => {
    return categoriesByType[type] || [];
  }, [categoriesByType, type]);

  const categoryEmptyMessage = useMemo(() => {
    if (type === 'transfer') return null;
    const baseMessage = type === 'income' ? 'Belum ada kategori pemasukan' : 'Belum ada kategori pengeluaran';
    const baseList = categoriesByType[type] || [];
    if (!baseList.length) return baseMessage;
    if (!filteredCategories.length) {
      return baseMessage;
    }
    return null;
  }, [type, categoriesByType, filteredCategories.length]);

  useEffect(() => {
    if (type === 'transfer') return;
    const list = categoriesByType[type] || [];
    if (!list.length) return;
    if (!categoryId || !list.some((item) => item.id === categoryId)) {
      setCategoryId(list[0].id);
    }
  }, [categoriesByType, categoryId, type]);

  const selectedAccount = accounts.find((item) => item.id === accountId);
  const selectedToAccount = accounts.find((item) => item.id === toAccountId);
  const selectedCategory = categories.find((item) => item.id === categoryId);
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
        __persisted: true,
      };

      onAdd?.(payload);
      addToast('Transaksi dibuat dari template.', 'success');
      navigate('/transactions');
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
          <div className="space-y-6">
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
                      <input
                        type="date"
                        value={date}
                        onChange={(event) => handleDateSelect(event.target.value)}
                        className={INPUT_CLASS}
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
                      {`+${CURRENCY_FORMATTER.format(value)}`}
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
                      {accounts
                        .filter((account) => account.id !== accountId)
                        .map((account) => (
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
                      disabled={filteredCategories.length === 0}
                    >
                      <option value="">Pilih kategori</option>
                      {filteredCategories.map((category) => (
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
                <input
                  id="title"
                  aria-label="Judul (opsional)"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Contoh: Makan siang tim"
                  className={INPUT_CLASS}
                />
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
                    <ul className="space-y-3">
                      {templates.map((template) => {
                        const accountName = accounts.find((item) => item.id === template.account_id)?.name || 'Akun tidak ditemukan';
                        const toAccountName = template.to_account_id
                          ? accounts.find((item) => item.id === template.to_account_id)?.name || 'Akun tidak ditemukan'
                          : null;
                        const categoryName = template.category_id
                          ? categories.find((item) => item.id === template.category_id)?.name || 'Kategori tidak ditemukan'
                          : null;
                        return (
                          <li
                            key={template.id}
                            className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg dark:bg-zinc-900/60"
                          >
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-text">{template.name || 'Tanpa judul'}</p>
                                  <p className="text-2xl font-bold tracking-tight text-text">
                                    {formatAmountDisplay(template.amount)}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
                                  <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle/80 bg-background px-3 py-1 text-muted-foreground">
                                    <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                    {accountName || '—'}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle/80 bg-background px-3 py-1 text-muted-foreground">
                                    {template.type === 'transfer' ? (
                                      <ArrowRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                    ) : (
                                      <TagIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                    )}
                                    {template.type === 'transfer' ? toAccountName || '—' : categoryName || '—'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplate(template)}
                                  disabled={Boolean(applyingTemplateId)}
                                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {applyingTemplateId === template.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                                  )}
                                  {applyingTemplateId === template.id ? 'Memproses...' : 'Gunakan'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  disabled={deletingTemplateId === template.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-border-subtle px-4 py-2 text-xs font-semibold text-muted transition hover:border-destructive/60 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {deletingTemplateId === template.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  )}
                                  Hapus
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
          </div>
        </form>
      </Section>
    </Page>
  );
}
