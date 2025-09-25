import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Building2,
  Check,
  Info,
  Loader2,
  RefreshCcw,
  Save,
  Tag as TagIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
  Receipt,
} from "lucide-react";
import Page from "../layout/Page";
import PageHeader from "../layout/PageHeader";
import Section from "../layout/Section";
import AmountInput from "../components/form/AmountInput";
import TagInput from "../components/inputs/TagInput";
import DateChips from "../components/ui/DateChips";
import { useToast } from "../context/ToastContext";
import { listAccounts, listCategories, listMerchants } from "../lib/api";
import { supabase } from "../lib/supabase";
import { createTransaction } from "../lib/transactionsApi";

const INPUT_CLASS =
  "h-11 w-full rounded-2xl border border-border/60 bg-background/70 px-3 text-sm text-foreground ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10";
const TEXTAREA_CLASS =
  "w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground ring-2 ring-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TYPE_OPTIONS = [
  {
    value: "income",
    label: "Income",
    description: "Catat pemasukan",
    icon: TrendingUp,
  },
  {
    value: "expense",
    label: "Expense",
    description: "Pengeluaran harian",
    icon: TrendingDown,
  },
  {
    value: "transfer",
    label: "Transfer",
    description: "Pindah antar akun",
    icon: ArrowLeftRight,
  },
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export default function TransactionAdd({ onAdd }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("expense");
  const [amountInput, setAmountInput] = useState("");
  const [date, setDate] = useState(() => formatDateForInput(0));
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [merchants, setMerchants] = useState([]);
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState([]);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    const loadMasterData = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const uid = userData?.user?.id;
        if (!uid) {
          throw new Error("Anda harus login untuk menambah transaksi.");
        }
        const [categoryRows, accountRows, merchantRows] = await Promise.all([
          listCategories(),
          listAccounts(),
          listMerchants(),
        ]);
        if (cancelled) return;
        const sortedAccounts = [...(accountRows || [])].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" }),
        );
        setAccounts(sortedAccounts);
        if (sortedAccounts.length) {
          setAccountId(sortedAccounts[0].id);
        }
        const mappedCategories = Array.isArray(categoryRows) ? categoryRows : [];
        setCategories(mappedCategories);
        const defaultCategory = mappedCategories.find((item) => item.type === "expense");
        if (defaultCategory) {
          setCategoryId(defaultCategory.id);
        }
        const sortedMerchants = [...(merchantRows || [])].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" }),
        );
        setMerchants(sortedMerchants);
      } catch (error) {
        console.error(error);
        addToast(error?.message || "Gagal memuat data awal", "error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMasterData();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  useEffect(() => {
    if (type !== "transfer") {
      setToAccountId("");
    }
  }, [type]);

  useEffect(() => {
    if (type === "transfer") {
      setCategoryId("");
      return;
    }
    const candidates = categories.filter((cat) => cat.type === type);
    if (!candidates.length) {
      setCategoryId("");
      return;
    }
    if (!candidates.some((cat) => cat.id === categoryId)) {
      setCategoryId(candidates[0].id);
    }
  }, [type, categories, categoryId]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => {
      map.set(cat.id, cat);
    });
    return map;
  }, [categories]);

  const accountMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((acc) => {
      map.set(acc.id, acc);
    });
    return map;
  }, [accounts]);

  const merchantMap = useMemo(() => {
    const map = new Map();
    merchants.forEach((merchant) => {
      map.set(merchant.name?.toLowerCase() || "", merchant);
      if (merchant.id) {
        map.set(merchant.id, merchant);
      }
    });
    return map;
  }, [merchants]);

  const handleMerchantChange = (event) => {
    const value = event.target.value;
    setMerchantInput(value);
    const matched = merchantMap.get(value.trim().toLowerCase());
    if (matched) {
      setMerchantId(matched.id || "");
    } else {
      setMerchantId("");
    }
  };

  const handleMerchantBlur = () => {
    const matched = merchantMap.get(merchantInput.trim().toLowerCase());
    if (matched) {
      setMerchantInput(matched.name || "");
      setMerchantId(matched.id || "");
    }
  };

  const merchantSuggestions = useMemo(() => {
    return merchants.slice(0, 12);
  }, [merchants]);

  const toAccountOptions = useMemo(() => {
    return accounts.filter((acc) => acc.id !== accountId);
  }, [accounts, accountId]);

  const summaryItems = useMemo(() => {
    const items = [
      { label: "Tipe", value: renderTypeLabel(type) },
      { label: "Tanggal", value: formatReadableDate(date) },
      { label: "Jumlah", value: formatCurrency(amountInput) },
      {
        label: "Akun Sumber",
        value: accountMap.get(accountId)?.name || "Belum dipilih",
      },
    ];
    if (type === "transfer") {
      items.push({
        label: "Akun Tujuan",
        value: accountMap.get(toAccountId)?.name || "Belum dipilih",
      });
    } else {
      items.push({
        label: "Kategori",
        value: categoryMap.get(categoryId)?.name || "Belum dipilih",
      });
    }
    if (merchantInput) {
      items.push({ label: "Merchant", value: merchantInput });
    }
    if (title) {
      items.push({ label: "Judul", value: title });
    }
    if (notes) {
      items.push({ label: "Catatan", value: notes });
    }
    if (tags.length) {
      items.push({ label: "Tags", value: tags.join(", ") });
    }
    return items;
  }, [type, date, amountInput, accountId, toAccountId, categoryId, merchantInput, title, notes, tags, accountMap, categoryMap]);

  const rules = useMemo(() => {
    if (type === "transfer") {
      return "Kategori disembunyikan saat Transfer. Pastikan akun tujuan berbeda.";
    }
    if (type === "income") {
      return "Kategori opsional untuk pemasukan. Akun sumber wajib diisi.";
    }
    return "Pengeluaran wajib memilih kategori dan akun sumber.";
  }, [type]);

  const handleTypeChange = (nextType) => {
    setType(nextType);
    setErrors((prev) => ({ ...prev, type: undefined }));
  };

  const handleDatePreset = (offset) => {
    setDate(formatDateForInput(offset));
  };

  const handleReset = () => {
    setType("expense");
    setAmountInput("");
    setDate(formatDateForInput(0));
    setAccountId(accounts[0]?.id || "");
    setToAccountId("");
    const defaultCategory = categories.find((item) => item.type === "expense");
    setCategoryId(defaultCategory?.id || "");
    setMerchantInput("");
    setMerchantId("");
    setTitle("");
    setNotes("");
    setTags([]);
    setReceiptUrl("");
    setErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const validationErrors = {};
    const amountNumber = amountInput ? Number.parseInt(amountInput, 10) : 0;
    if (!amountNumber || amountNumber <= 0) {
      validationErrors.amount = "Jumlah wajib diisi dan harus lebih besar dari nol.";
    }
    if (!accountId) {
      validationErrors.account_id = "Pilih akun sumber.";
    }
    if (!DATE_REGEX.test(date)) {
      validationErrors.date = "Tanggal tidak valid.";
    }
    if (type === "transfer") {
      if (!toAccountId) {
        validationErrors.to_account_id = "Pilih akun tujuan transfer.";
      } else if (toAccountId === accountId) {
        validationErrors.to_account_id = "Akun tujuan harus berbeda dengan akun sumber.";
      }
    } else {
      if (toAccountId) {
        validationErrors.to_account_id = "Akun tujuan hanya digunakan untuk transfer.";
      }
      if (type === "expense" && !categoryId) {
        validationErrors.category_id = "Kategori wajib untuk pengeluaran.";
      }
    }
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const payload = {
        date,
        type,
        amount: amountNumber,
        account_id: accountId,
        to_account_id: type === "transfer" ? toAccountId : null,
        category_id: type === "transfer" ? null : categoryId || null,
        merchant_id: merchantId || null,
        title: title.trim() ? title.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        tags: tags.length ? tags : null,
        receipt_url: receiptUrl.trim() ? receiptUrl.trim() : null,
      };
      const saved = await createTransaction(payload);
      const accountName = accountMap.get(accountId)?.name || null;
      const toAccountName = type === "transfer" ? accountMap.get(toAccountId)?.name || null : null;
      const categoryName = type !== "transfer" ? categoryMap.get(categoryId)?.name || null : null;
      const merchantName = merchantId ? merchantMap.get(merchantId)?.name || merchantInput : merchantInput;
      onAdd?.({
        ...saved,
        type,
        amount: amountNumber,
        date,
        account_id: accountId,
        account_name: accountName,
        to_account_id: type === "transfer" ? toAccountId : null,
        to_account_name: toAccountName,
        category_id: type === "transfer" ? null : categoryId || null,
        category: categoryName,
        merchant_id: merchantId || null,
        merchant_name: merchantName || null,
        title: payload.title,
        notes: payload.notes,
        tags: tags,
        receipt_url: payload.receipt_url,
        __persisted: true,
      });
      addToast("Transaksi tersimpan", "success");
      handleReset();
      navigate("/transactions");
    } catch (error) {
      console.error(error);
      addToast(error?.message || "Gagal menyimpan transaksi", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <Section first className="max-w-4xl">
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/80 p-10 text-muted-foreground shadow-sm dark:border-white/10">
            <Loader2 className="h-5 w-5 animate-spin" />
            Memuat formulir...
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Tambah Transaksi">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            form="transaction-form"
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </button>
          <button
            type="button"
            onClick={() => navigate("/transactions")}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Batal
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10"
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </PageHeader>

      <Section first>
        <form id="transaction-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <TypeSegmented value={type} onChange={handleTypeChange} />
              <div className="flex flex-wrap items-center gap-3">
                <DateChips onSelect={handleDatePreset} activeDate={date} />
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className={`${INPUT_CLASS} w-auto`}
                  aria-invalid={Boolean(errors.date)}
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-6 rounded-2xl border border-border/60 bg-gradient-to-b from-white/80 to-white/50 p-5 shadow-sm backdrop-blur md:p-6 dark:from-zinc-900/60 dark:to-zinc-900/30 dark:border-white/10">
                <AmountInput
                  value={amountInput}
                  onChange={setAmountInput}
                  error={errors.amount}
                  helper="Masukkan nominal transaksi"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Akun Sumber" icon={Wallet} error={errors.account_id}>
                    <select
                      value={accountId}
                      onChange={(event) => setAccountId(event.target.value)}
                      className={INPUT_CLASS}
                      aria-invalid={Boolean(errors.account_id)}
                      required
                    >
                      <option value="">Pilih akun</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name || "(Tanpa nama)"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {type === "transfer" ? (
                    <Field label="Akun Tujuan" icon={ArrowRight} error={errors.to_account_id}>
                      <select
                        value={toAccountId}
                        onChange={(event) => setToAccountId(event.target.value)}
                        className={INPUT_CLASS}
                        aria-invalid={Boolean(errors.to_account_id)}
                        required
                      >
                        <option value="">Pilih akun</option>
                        {toAccountOptions.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name || "(Tanpa nama)"}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Kategori" icon={TagIcon} error={errors.category_id}>
                      <select
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className={INPUT_CLASS}
                        aria-invalid={Boolean(errors.category_id)}
                        required={type === "expense"}
                        disabled={type === "transfer"}
                      >
                        <option value="">Pilih kategori</option>
                        {categories
                          .filter((cat) => cat.type === type)
                          .map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}
                </div>

                <Field label="Merchant" icon={Building2} helper="Opsional" error={errors.merchant_id}>
                  <div className="relative">
                    <input
                      list="merchant-suggestions"
                      value={merchantInput}
                      onChange={handleMerchantChange}
                      onBlur={handleMerchantBlur}
                      className={INPUT_CLASS}
                      placeholder="Cari atau ketik nama merchant"
                    />
                    <datalist id="merchant-suggestions">
                      {merchantSuggestions.map((merchant) => (
                        <option key={merchant.id || merchant.name} value={merchant.name || ""} />
                      ))}
                    </datalist>
                  </div>
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Judul" icon={Check} helper="Opsional">
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Contoh: Makan siang"
                    />
                  </Field>
                  <Field label="URL Struk" icon={Receipt} helper="Opsional">
                    <input
                      type="url"
                      value={receiptUrl}
                      onChange={(event) => setReceiptUrl(event.target.value)}
                      className={INPUT_CLASS}
                      placeholder="https://"
                    />
                  </Field>
                </div>

                <Field label="Catatan" icon={Info} helper="Tambahkan detail tambahan">
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={TEXTAREA_CLASS}
                    rows={4}
                    placeholder="Catatan tambahan"
                  />
                </Field>

                <TagInput value={tags} onChange={setTags} />
              </div>

              <HelpPanel summary={summaryItems} rule={rules} saving={saving} />
            </div>
          </div>
        </form>
      </Section>
    </Page>
  );
}

function TypeSegmented({ value, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-2">
      <div className="inline-flex rounded-2xl border border-border/60 bg-muted/40 p-1 dark:border-white/10">
        {TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? "h-9 bg-primary text-primary-foreground shadow"
                  : "h-9 text-muted-foreground hover:bg-muted/60"
              }`}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, helper, error, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span>{label}</span>
        {helper ? <span className="text-xs font-normal text-muted-foreground/80">{helper}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function HelpPanel({ summary, rule, saving }) {
  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-gradient-to-b from-white/80 to-white/50 p-5 text-sm shadow-sm backdrop-blur md:p-6 dark:from-zinc-900/60 dark:to-zinc-900/30 dark:border-white/10">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Ringkasan</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {summary.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-3">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="text-right text-muted-foreground">{item.value}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-muted-foreground dark:border-white/10">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 text-primary" />
          <p className="text-sm leading-relaxed">{rule}</p>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-border/60 p-3 text-muted-foreground dark:border-white/10">
        <p className="text-sm font-medium text-foreground">Tips Keyboard</p>
        <ul className="mt-1 space-y-1 text-sm">
          <li>
            <kbd className="rounded border bg-muted/60 px-1.5 py-0.5 text-xs">Enter</kbd> = Simpan
          </li>
          <li>
            <kbd className="rounded border bg-muted/60 px-1.5 py-0.5 text-xs">Esc</kbd> = Batal
          </li>
        </ul>
      </div>
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-muted-foreground dark:border-white/10">
        <p className="text-sm">{saving ? "Menyimpan transaksi..." : "Pastikan data utama terisi sebelum menyimpan."}</p>
      </div>
    </aside>
  );
}

function formatDateForInput(offset = 0) {
  const base = new Date();
  const zoned = new Date(base.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  zoned.setDate(zoned.getDate() + offset);
  return DATE_FORMATTER.format(zoned);
}

function formatReadableDate(value) {
  if (!value || !DATE_REGEX.test(value)) return "-";
  const [year, month, day] = value.split("-");
  const display = new Date(`${year}-${month}-${day}T00:00:00`);
  return display.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(amountValue) {
  if (!amountValue) return "-";
  const parsed = Number.parseInt(amountValue, 10);
  if (!parsed) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(parsed);
}

function renderTypeLabel(type) {
  if (type === "income") return "Pemasukan";
  if (type === "transfer") return "Transfer";
  return "Pengeluaran";
}
