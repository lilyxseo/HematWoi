import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeftRight,
  Banknote,
  Calendar,
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
import { createTransaction } from '../lib/transactionsApi';
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

const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
const CURRENCY_FORMATTER = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 });

const QUICK_AMOUNTS = [50000, 100000, 250000, 500000];

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

  useEffect(() => {
    let active = true;
    async function loadMasterData() {
      setLoading(true);
      try {
        const [accountRows, categoryRows] = await Promise.all([listAccounts(), listCategories()]);
        if (!active) return;
        const sortedAccounts = (accountRows || []).slice().sort((a, b) => {
          return (a.name || '').localeCompare(b.name || '', 'id');
        });
        setAccounts(sortedAccounts);
        if (sortedAccounts.length) {
          setAccountId(sortedAccounts[0].id);
        }
        setCategories(categoryRows || []);
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

  const isTransfer = type === 'transfer';
  const amountValue = parseAmount(amountInput);
  const typeSummary = useMemo(() => {
    switch (type) {
      case 'income':
        return {
          label: 'Pemasukan',
          description: 'Saldo akan bertambah pada akun sumber.',
          icon: TrendingUp,
        };
      case 'transfer':
        return {
          label: 'Transfer',
          description: 'Dana akan dipindahkan antar dua akun berbeda.',
          icon: ArrowLeftRight,
        };
      default:
        return {
          label: 'Pengeluaran',
          description: 'Saldo akan berkurang dari akun sumber.',
          icon: TrendingDown,
        };
    }
  }, [type]);
  const TypeIcon = typeSummary.icon;
  const trimmedTitle = title.trim();
  const trimmedNotes = notes.trim();
  const titleDisplay = trimmedTitle || 'Belum diisi';
  const notesDisplay = trimmedNotes || 'Belum ada catatan';
  const categoryDisplay = !isTransfer ? selectedCategory?.name || 'Belum dipilih' : null;
  const toAccountDisplay = isTransfer ? selectedToAccount?.name || 'Belum dipilih' : null;
  const receiptStatus = receiptFile ? `File dipilih: ${receiptFile.name}` : 'Belum ada struk yang dipilih';

  const handleAmountChange = (event) => {
    const value = event.target.value;
    setAmountInput(value.replace(/[^0-9.,]/g, ''));
    setErrors((prev) => ({ ...prev, amount: undefined }));
  };

  const handleQuickAmountSelect = (value) => {
    setAmountInput(CURRENCY_FORMATTER.format(value));
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
        title: title.trim() ? title.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
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
        title: saved.title ?? (title.trim() || null),
        notes: saved.notes ?? (notes.trim() || null),
        note: saved.notes ?? (notes.trim() || null),
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
                  {QUICK_AMOUNTS.map((value) => {
                    const active = amountValue === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleQuickAmountSelect(value)}
                        className={`h-9 rounded-xl border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border-subtle text-text hover:bg-muted/30'
                        }`}
                      >
                        {formatAmountDisplay(value)}
                      </button>
                    );
                  })}
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
                    >
                      <option value="">Pilih kategori</option>
                      {(categoriesByType[type] || []).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {errors.category_id ? <p className="mt-1 text-xs text-destructive">{errors.category_id}</p> : null}
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
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-text">Ringkasan cepat</h2>
                  <p className="text-sm text-muted">
                    Pantau informasi penting dari transaksi ini sebelum menyimpannya.
                  </p>
                </div>
                <div className="space-y-3 text-sm text-muted">
                  <div className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-muted/20 p-3">
                    <TypeIcon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-text">{typeSummary.label}</p>
                      <p className="text-xs text-muted">{typeSummary.description}</p>
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
                      <p className="text-xs text-muted">Tanggal tersimpan dalam zona waktu Asia/Jakarta</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Wallet className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-text">{selectedAccount?.name || 'Belum dipilih'}</p>
                      <p className="text-xs text-muted">Akun sumber</p>
                    </div>
                  </div>
                  {isTransfer ? (
                    <div className="flex items-start gap-3">
                      <ArrowRight className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-text">{toAccountDisplay}</p>
                        <p className="text-xs text-muted">Akun tujuan transfer</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <TagIcon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-text">{categoryDisplay}</p>
                        <p className="text-xs text-muted">Kategori transaksi</p>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-dashed border-border-subtle bg-muted/10 p-3 text-xs">
                    <p className="font-medium text-text">Detail tambahan</p>
                    <p className="mt-1 text-muted">
                      <span className="font-medium text-text">Judul:</span> {titleDisplay}
                    </p>
                    <p className="mt-1 text-muted">
                      <span className="font-medium text-text">Catatan:</span> {notesDisplay}
                    </p>
                    <p className="mt-1 text-muted">
                      <span className="font-medium text-text">Struk:</span> {receiptStatus}
                    </p>
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
