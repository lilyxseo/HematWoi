import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  Loader2,
  Receipt,
  RotateCcw,
  Save,
  Store,
  Tag as TagIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import Page from '../../layout/Page';
import PageHeader from '../../layout/PageHeader';
import Section from '../../layout/Section';
import AmountInput from '../../components/form/AmountInput';
import TagInput from '../../components/form/TagInput';
import DateQuickSelect, { getTodayJakarta } from '../../components/ui/DateQuickSelect';
import { listCategories, listAccounts, listMerchants } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext';
import { createTransaction } from '../../lib/transactionsApi';
import { enqueueReceiptPut } from '../../lib/sync/attachments';

type TransactionType = 'income' | 'expense' | 'transfer';

type CategoryRecord = {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
};

type AccountRecord = {
  id: string;
  name: string;
};

type MerchantRecord = {
  id: string;
  name: string;
};

type FormState = {
  type: TransactionType;
  date: string;
  amount: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  merchantInput: string;
  merchantId: string | null;
  title: string;
  notes: string;
  tags: string[];
  receiptUrl: string;
  receiptFile: File | null;
};

type FormErrors = Partial<{
  amount: string;
  date: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
}>;

const TYPE_OPTIONS: { value: TransactionType; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: 'income', label: 'Income', icon: TrendingUp },
  { value: 'expense', label: 'Expense', icon: TrendingDown },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
];

function normalizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => Boolean(tag))
        .map((tag) => tag.replace(/\s+/g, ' ')),
    ),
  );
}

function initialFormState(): FormState {
  return {
    type: 'expense',
    date: getTodayJakarta(),
    amount: '',
    accountId: '',
    toAccountId: '',
    categoryId: '',
    merchantInput: '',
    merchantId: null,
    title: '',
    notes: '',
    tags: [],
    receiptUrl: '',
    receiptFile: null,
  };
}

function sanitizeNumber(value: string): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/[^0-9.,-]/g, '').replace(/,/g, '.'));
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

export default function AddTransactionPage({ onAdd }: { onAdd?: (payload: any) => Promise<void> | void }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState<FormState>(() => initialFormState());
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [merchants, setMerchants] = useState<MerchantRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const [accountRows, categoryRows, merchantRows] = await Promise.all([
          listAccounts(),
          listCategories(),
          listMerchants(),
        ]);
        if (cancelled) return;
        const normalizedAccounts = Array.isArray(accountRows) ? accountRows : [];
        const normalizedCategories = Array.isArray(categoryRows) ? categoryRows : [];
        const normalizedMerchants = Array.isArray(merchantRows) ? merchantRows : [];
        setAccounts(normalizedAccounts.map((row: any) => ({ id: row.id, name: row.name || 'Tanpa nama' })));
        setCategories(
          normalizedCategories.map((row: any) => ({
            id: row.id,
            name: row.name,
            type: (row.type || 'expense') as 'income' | 'expense' | 'transfer',
          })),
        );
        setMerchants(normalizedMerchants.map((row: any) => ({ id: row.id, name: row.name || '' })));
        if (!form.accountId && normalizedAccounts.length) {
          setForm((prev) => ({ ...prev, accountId: normalizedAccounts[0].id ?? '' }));
        }
      } catch (error) {
        console.error(error);
        addToast(error instanceof Error ? error.message : 'Gagal memuat data master.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (form.type !== 'transfer' && form.toAccountId) {
      setForm((prev) => ({ ...prev, toAccountId: '' }));
    }
    if (form.type === 'transfer' && form.categoryId) {
      setForm((prev) => ({ ...prev, categoryId: '' }));
    }
  }, [form.type]);

  useEffect(() => {
    if (form.type === 'transfer' && form.toAccountId && form.toAccountId === form.accountId) {
      setForm((prev) => ({ ...prev, toAccountId: '' }));
    }
  }, [form.accountId, form.toAccountId, form.type]);

  useEffect(() => {
    if (!form.merchantInput) {
      setForm((prev) => ({ ...prev, merchantId: null }));
      return;
    }
    const matched = merchants.find(
      (merchant) => merchant.name.toLowerCase() === form.merchantInput.trim().toLowerCase(),
    );
    setForm((prev) => ({ ...prev, merchantId: matched ? matched.id : null }));
  }, [form.merchantInput, merchants]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryOptions = useMemo(() => {
    if (form.type === 'transfer') return [];
    return categories.filter((cat) => cat.type === form.type);
  }, [categories, form.type]);

  const destinationAccounts = useMemo(() => {
    if (form.type !== 'transfer') return [];
    return accounts.filter((account) => account.id !== form.accountId);
  }, [accounts, form.accountId, form.type]);

  const merchantListId = 'merchant-suggestions';

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'amount' || key === 'date' || key === 'accountId' || key === 'toAccountId' || key === 'categoryId') {
      setErrors((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleTypeChange = (value: TransactionType) => {
    setForm((prev) => ({
      ...prev,
      type: value,
      toAccountId: value === 'transfer' ? prev.toAccountId : '',
      categoryId: value === 'transfer' ? '' : prev.categoryId,
    }));
    setErrors({});
  };

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    const amountValue = sanitizeNumber(form.amount);
    if (!form.amount) {
      nextErrors.amount = 'Jumlah wajib diisi';
    } else if (amountValue <= 0) {
      nextErrors.amount = 'Jumlah harus lebih besar dari 0';
    }
    if (!form.date) {
      nextErrors.date = 'Tanggal wajib diisi';
    }
    if (!form.accountId) {
      nextErrors.accountId = 'Pilih akun sumber';
    }
    if (form.type === 'transfer') {
      if (!form.toAccountId) {
        nextErrors.toAccountId = 'Pilih akun tujuan';
      } else if (form.toAccountId === form.accountId) {
        nextErrors.toAccountId = 'Akun tujuan tidak boleh sama dengan akun sumber';
      }
    }
    if (form.type === 'expense' && !form.categoryId) {
      nextErrors.categoryId = 'Kategori wajib diisi';
    }
    return nextErrors;
  };

  const handleSubmit = async () => {
    const foundErrors = validate();
    if (Object.keys(foundErrors).length) {
      setErrors(foundErrors);
      addToast('Periksa kembali data yang wajib diisi.', 'error');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const amountValue = sanitizeNumber(form.amount);
      const tags = normalizeTags(form.tags);
      const payload = {
        type: form.type,
        amount: amountValue,
        date: form.date,
        account_id: form.accountId || null,
        to_account_id: form.type === 'transfer' ? form.toAccountId || null : null,
        category_id: form.type === 'transfer' ? null : form.categoryId || null,
        title: form.title.trim() ? form.title.trim() : null,
        notes: form.notes.trim() ? form.notes.trim() : null,
        merchant_id: form.merchantId,
        tags,
        receipt_url: form.receiptUrl.trim() ? form.receiptUrl.trim() : null,
      };
      const saved = await createTransaction(payload);
      if (form.receiptFile && saved?.id) {
        try {
          await enqueueReceiptPut(form.receiptFile, saved.id);
        } catch (receiptError) {
          console.error(receiptError);
          addToast('Struk akan diunggah ketika koneksi stabil.', 'info');
        }
      }
      if (onAdd) {
        const sourceAccount = accounts.find((acc) => acc.id === payload.account_id);
        const destinationAccount = accounts.find((acc) => acc.id === payload.to_account_id);
        const categoryName = categories.find((cat) => cat.id === payload.category_id)?.name;
        const frontRecord = {
          ...saved,
          type: form.type,
          amount: amountValue,
          date: form.date,
          account_id: payload.account_id,
          to_account_id: payload.to_account_id,
          category_id: payload.category_id,
          merchant_id: payload.merchant_id,
          title: payload.title,
          notes: payload.notes,
          tags,
          receipt_url: payload.receipt_url ?? saved?.receipt_url ?? null,
          merchant_name: form.merchantInput.trim() ? toTitleCase(form.merchantInput.trim()) : undefined,
          account_name: sourceAccount?.name,
          to_account_name: destinationAccount?.name,
          category: categoryName,
          category_name: categoryName,
          skipCloud: true,
        };
        try {
          await onAdd(frontRecord);
        } catch (syncError) {
          console.error(syncError);
        }
      }
      addToast('Transaksi tersimpan', 'success');
      resetForm();
      navigate('/transactions');
    } catch (error) {
      console.error(error);
      addToast(error instanceof Error ? error.message : 'Gagal menyimpan transaksi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm((prev) => ({
      ...initialFormState(),
      accountId: prev.accountId,
    }));
    setErrors({});
  };

  const handleCancel = () => {
    navigate(-1);
  };

  const helperMessages = [
    form.type === 'transfer' ? 'Kategori disembunyikan saat Transfer.' : 'Kategori wajib untuk pengeluaran.',
    'Gunakan tombol Enter untuk menyimpan, Esc untuk batal.',
    form.toAccountId && form.toAccountId === form.accountId ? 'Pilih akun tujuan berbeda saat transfer.' : '',
  ].filter(Boolean);

  const formDisabled = loading || saving;

  return (
    <Page>
      <Section first className="mx-auto max-w-6xl">
        <PageHeader title="Tambah Transaksi">
          <button
            type="button"
            className="h-11 rounded-2xl border border-border/60 px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={handleCancel}
            disabled={saving}
          >
            <ArrowLeft className="mr-2 inline h-4 w-4" /> Batal
          </button>
          <button
            type="button"
            className="h-11 rounded-2xl border border-border/60 px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={resetForm}
            disabled={formDisabled}
          >
            <RotateCcw className="mr-2 inline h-4 w-4" /> Reset
          </button>
          <button
            type="button"
            className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            onClick={handleSubmit}
            disabled={formDisabled}
          >
            {saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Save className="mr-2 inline h-4 w-4" />} Simpan
          </button>
        </PageHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat formulir...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <div className="rounded-2xl border border-white/60 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
                      {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleTypeChange(value)}
                          data-active={form.type === value}
                          className={clsx(
                            'inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            form.type === value
                              ? 'bg-primary text-primary-foreground shadow'
                              : 'text-muted-foreground hover:bg-white/60 dark:hover:bg-zinc-800/80',
                          )}
                          disabled={saving}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <DateQuickSelect
                      label="Tanggal"
                      value={form.date}
                      onChange={(date) => setField('date', date)}
                      disabled={formDisabled}
                      error={errors.date ?? null}
                    />
                  </div>

                  <AmountInput
                    label="Jumlah"
                    value={form.amount}
                    onChange={(value) => setField('amount', value)}
                    helperText="Masukkan nominal transaksi."
                    error={errors.amount ?? null}
                    disabled={formDisabled}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="account" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Wallet className="h-4 w-4" aria-hidden="true" /> Akun sumber
                      </label>
                      <select
                        id="account"
                        value={form.accountId}
                        onChange={(event) => setField('accountId', event.target.value)}
                        disabled={formDisabled}
                        className={clsx(
                          'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          errors.accountId && 'ring-destructive/40',
                        )}
                      >
                        <option value="" disabled>
                          Pilih akun
                        </option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                      {errors.accountId ? (
                        <p className="text-xs font-medium text-destructive">{errors.accountId}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Dana akan diambil dari akun ini.</p>
                      )}
                    </div>

                    {form.type === 'transfer' ? (
                      <div className="space-y-2">
                        <label htmlFor="to-account" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <ArrowRight className="h-4 w-4" aria-hidden="true" /> Akun tujuan
                        </label>
                        <select
                          id="to-account"
                          value={form.toAccountId}
                          onChange={(event) => setField('toAccountId', event.target.value)}
                          disabled={formDisabled}
                          className={clsx(
                            'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            errors.toAccountId && 'ring-destructive/40',
                          )}
                        >
                          <option value="" disabled>
                            Pilih akun tujuan
                          </option>
                          {destinationAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </select>
                        {errors.toAccountId ? (
                          <p className="text-xs font-medium text-destructive">{errors.toAccountId}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Pastikan akun tujuan berbeda dari sumber.</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label htmlFor="category" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <TagIcon className="h-4 w-4" aria-hidden="true" /> Kategori
                        </label>
                        <select
                          id="category"
                          value={form.categoryId}
                          onChange={(event) => setField('categoryId', event.target.value)}
                          disabled={formDisabled || !categoryOptions.length}
                          className={clsx(
                            'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60',
                            errors.categoryId && 'ring-destructive/40',
                          )}
                        >
                          <option value="">
                            {categoryOptions.length ? 'Pilih kategori' : 'Tidak ada kategori'}
                          </option>
                          {categoryOptions.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        {errors.categoryId ? (
                          <p className="text-xs font-medium text-destructive">{errors.categoryId}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Kategori membantu laporan lebih akurat.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="merchant" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Store className="h-4 w-4" aria-hidden="true" /> Merchant (opsional)
                    </label>
                    <input
                      id="merchant"
                      type="text"
                      value={form.merchantInput}
                      onChange={(event) => setField('merchantInput', event.target.value)}
                      list={merchantListId}
                      placeholder="Cari atau ketik merchant"
                      disabled={formDisabled}
                      className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <datalist id={merchantListId}>
                      {merchants.map((merchant) => (
                        <option key={merchant.id} value={merchant.name} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">Mulai ketik untuk melihat saran merchant.</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="title" className="text-sm font-medium text-muted-foreground">
                        Judul (opsional)
                      </label>
                      <input
                        id="title"
                        type="text"
                        value={form.title}
                        onChange={(event) => setField('title', event.target.value)}
                        placeholder="Contoh: Makan siang tim"
                        disabled={formDisabled}
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="notes" className="text-sm font-medium text-muted-foreground">
                        Catatan (opsional)
                      </label>
                      <textarea
                        id="notes"
                        value={form.notes}
                        onChange={(event) => setField('notes', event.target.value)}
                        rows={3}
                        placeholder="Tuliskan detail tambahan"
                        disabled={formDisabled}
                        className="w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>
                  </div>

                  <TagInput
                    label="Tags"
                    value={form.tags}
                    onChange={(next) => setField('tags', next)}
                    helperText="Pisahkan dengan koma atau spasi."
                    disabled={formDisabled}
                  />

                  <div className="space-y-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Receipt className="h-4 w-4" aria-hidden="true" /> Upload Struk (opsional)
                    </span>
                    <div
                      className={clsx(
                        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground transition focus-within:border-primary focus-within:text-primary dark:border-zinc-700/70 dark:bg-zinc-900/40',
                        formDisabled && 'opacity-60',
                      )}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!formDisabled) event.dataTransfer.dropEffect = 'copy';
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (formDisabled) return;
                        const file = event.dataTransfer.files?.[0];
                        if (file) {
                          setField('receiptFile', file);
                        }
                      }}
                    >
                      {form.receiptFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{form.receiptFile.name}</p>
                          <button
                            type="button"
                            onClick={() => setField('receiptFile', null)}
                            className="h-9 rounded-xl border border-border/60 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            Hapus file
                          </button>
                        </div>
                      ) : (
                        <>
                          <p>Tarik & lepaskan struk di sini atau pilih file.</p>
                          <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary">
                            Pilih file
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) setField('receiptFile', file);
                              }}
                              disabled={formDisabled}
                            />
                          </label>
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="receipt-url" className="text-sm font-medium text-muted-foreground">
                        atau tempel URL struk
                      </label>
                      <input
                        id="receipt-url"
                        type="url"
                        value={form.receiptUrl}
                        onChange={(event) => setField('receiptUrl', event.target.value)}
                        placeholder="https://"
                        disabled={formDisabled}
                        className="h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground">URL akan disimpan langsung bila tersedia.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-white/60 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
                <h2 className="text-sm font-semibold text-muted-foreground">Ringkasan arus kas</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary dark:bg-primary/20">
                      <Wallet className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">Sumber dana</p>
                      <p className="text-muted-foreground">{accounts.find((acc) => acc.id === form.accountId)?.name || 'Belum dipilih'}</p>
                    </div>
                  </div>
                  {form.type === 'transfer' ? (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary dark:bg-primary/20">
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">Tujuan transfer</p>
                        <p className="text-muted-foreground">
                          {destinationAccounts.find((acc) => acc.id === form.toAccountId)?.name || 'Belum dipilih'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary dark:bg-primary/20">
                        <TagIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">Kategori</p>
                        <p className="text-muted-foreground">
                          {categoryOptions.find((cat) => cat.id === form.categoryId)?.name || 'Belum dipilih'}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary dark:bg-primary/20">
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">Tanggal</p>
                      <p className="text-muted-foreground">{form.date || 'Belum dipilih'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/60 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
                <h2 className="text-sm font-semibold text-muted-foreground">Validasi pintar</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {helperMessages.map((message) => (
                    <li key={message} className="rounded-xl bg-muted/40 px-3 py-2">
                      {message}
                    </li>
                  ))}
                  {!helperMessages.length ? (
                    <li className="rounded-xl bg-muted/40 px-3 py-2">Isi semua data dengan teliti sebelum menyimpan.</li>
                  ) : null}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/60 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:from-zinc-900/60 dark:to-zinc-900/30 md:p-6">
                <h2 className="text-sm font-semibold text-muted-foreground">Tips</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="rounded-xl bg-muted/40 px-3 py-2">Enter = Simpan transaksi</li>
                  <li className="rounded-xl bg-muted/40 px-3 py-2">Esc = Batal dan kembali</li>
                  <li className="rounded-xl bg-muted/40 px-3 py-2">Gunakan tag untuk memudahkan pencarian cepat.</li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </Section>
    </Page>
  );
}
