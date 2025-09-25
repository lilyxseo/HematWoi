import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  Info,
  Loader2,
  Receipt,
  RotateCcw,
  Save,
  Tag as TagIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import Page from "../layout/Page";
import PageHeader from "../layout/PageHeader";
import Section from "../layout/Section";
import { AmountInput } from "../components/form/AmountInput";
import { TagInput } from "../components/inputs/TagInput";
import { DateChips } from "../components/ui/DateChips";
import { useToast } from "../context/ToastContext";
import { listAccounts, listCategories, listMerchants, saveMerchant } from "../lib/api";
import { supabase } from "../lib/supabase";
import { createTransaction } from "../lib/transactionsApi";

const CARD_CLASS =
  "rounded-2xl border p-5 md:p-6 bg-gradient-to-b from-white/80 to-white/50 dark:from-zinc-900/60 dark:to-zinc-900/30 backdrop-blur shadow-sm";
const INPUT_CLASS =
  "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm text-foreground ring-2 ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const TEXTAREA_CLASS =
  "min-h-[120px] w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground ring-2 ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const TYPE_OPTIONS = [
  { value: "income", label: "Income", icon: TrendingUp },
  { value: "expense", label: "Expense", icon: TrendingDown },
  { value: "transfer", label: "Transfer", icon: ArrowLeftRight },
];

function getJakartaDate(offset = 0) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const base = new Date();
  const shifted = new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
  return formatter.format(shifted);
}

function parseAmount(value) {
  if (!value) return 0;
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
}

function formatCurrency(amount) {
  if (!Number.isFinite(amount)) return "Rp0";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

export default function TransactionAdd({ onAdd }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [userId, setUserId] = useState("");

  const [type, setType] = useState("expense");
  const [date, setDate] = useState(() => getJakartaDate());
  const [amountInput, setAmountInput] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState([]);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [errors, setErrors] = useState({});

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [merchants, setMerchants] = useState([]);

  const amountNumber = parseAmount(amountInput);
  const isTransfer = type === "transfer";

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        const uid = data.user?.id;
        if (!uid) {
          throw new Error("Anda harus login untuk membuat transaksi.");
        }
        if (!active) return;
        setUserId(uid);
        const [accountRows, categoryRows, merchantRows] = await Promise.all([
          listAccounts(),
          listCategories(),
          listMerchants(),
        ]);
        if (!active) return;
        setAccounts(accountRows || []);
        setCategories(categoryRows || []);
        setMerchants(merchantRows || []);
        if (accountRows?.length) {
          setAccountId((prev) => prev || accountRows[0].id || "");
        }
      } catch (err) {
        console.error(err);
        addToast(err?.message || "Gagal memuat data master", "error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [addToast]);

  const categoriesByType = useMemo(() => {
    const map = { income: [], expense: [] };
    (categories || []).forEach((cat) => {
      const key = (cat.type || "expense").toLowerCase();
      if (map[key]) {
        map[key].push(cat);
      }
    });
    return map;
  }, [categories]);

  useEffect(() => {
    if (isTransfer) {
      setCategoryId("");
      setErrors((prev) => ({ ...prev, category: undefined }));
    } else {
      const list = categoriesByType[type] || [];
      if (list.length === 0) {
        setCategoryId("");
        return;
      }
      if (!list.some((cat) => cat.id === categoryId)) {
        setCategoryId(list[0].id || "");
      }
    }
  }, [isTransfer, categoriesByType, type, categoryId]);

  useEffect(() => {
    if (!isTransfer && toAccountId) {
      setToAccountId("");
    }
  }, [isTransfer, toAccountId]);

  const destinationAccounts = useMemo(
    () => accounts.filter((acc) => acc.id !== accountId),
    [accounts, accountId],
  );

  const matchedMerchant = useMemo(() => {
    const name = merchantInput.trim().toLowerCase();
    if (!name) return null;
    return merchants.find((merchant) => (merchant.name || "").toLowerCase() === name) || null;
  }, [merchantInput, merchants]);

  useEffect(() => {
    if (matchedMerchant) {
      setMerchantId(matchedMerchant.id);
    } else {
      setMerchantId("");
    }
  }, [matchedMerchant]);

  const selectedAccount = useMemo(() => accounts.find((acc) => acc.id === accountId) || null, [accounts, accountId]);
  const selectedToAccount = useMemo(
    () => accounts.find((acc) => acc.id === toAccountId) || null,
    [accounts, toAccountId],
  );
  const selectedCategory = useMemo(
    () => (categoriesByType[type] || []).find((cat) => cat.id === categoryId) || null,
    [categoriesByType, type, categoryId],
  );

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        navigate(-1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  const canSubmit = useMemo(() => {
    const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (!hasValidDate || amountNumber <= 0 || !accountId) return false;
    if (isTransfer) {
      return Boolean(toAccountId && toAccountId !== accountId);
    }
    if (type === "expense") {
      return Boolean(categoryId);
    }
    return true;
  }, [date, amountNumber, accountId, isTransfer, toAccountId, type, categoryId]);

  const resetForm = useCallback(() => {
    setType("expense");
    setDate(getJakartaDate());
    setAmountInput("");
    setAccountId((accounts[0] && accounts[0].id) || "");
    setToAccountId("");
    const firstCategory = (categoriesByType.expense || [])[0];
    setCategoryId(firstCategory ? firstCategory.id : "");
    setMerchantInput("");
    setMerchantId("");
    setTitle("");
    setNotes("");
    setTags([]);
    setReceiptUrl("");
    setErrors({});
  }, [accounts, categoriesByType]);

  const validate = useCallback(() => {
    const nextErrors = {};
    if (amountNumber <= 0) {
      nextErrors.amount = "Nominal harus lebih besar dari 0.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      nextErrors.date = "Tanggal wajib diisi (YYYY-MM-DD).";
    }
    if (!accountId) {
      nextErrors.account = "Pilih akun sumber.";
    }
    if (isTransfer) {
      if (!toAccountId) {
        nextErrors.toAccount = "Pilih akun tujuan transfer.";
      } else if (toAccountId === accountId) {
        nextErrors.toAccount = "Akun tujuan tidak boleh sama.";
      }
    } else if (type === "expense" && !categoryId) {
      nextErrors.category = "Kategori wajib untuk pengeluaran.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [amountNumber, date, accountId, isTransfer, toAccountId, type, categoryId]);

  const formId = "transaction-add-form";

  const handleUploadReceipt = async (file) => {
    if (!file) return;
    if (!userId) {
      addToast("Anda harus login untuk mengunggah struk", "error");
      return;
    }
    setReceiptUploading(true);
    try {
      const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}`;
      const safeName = file.name.replace(/[^a-z0-9.]+/gi, "-");
      const path = `receipts/${userId}/${randomId}-${safeName}`;
      const { error } = await supabase.storage.from("receipts").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("receipts").getPublicUrl(path);
      setReceiptUrl(data.publicUrl || "");
      addToast("Struk berhasil diunggah", "success");
    } catch (err) {
      console.error(err);
      addToast(err?.message || "Gagal mengunggah struk", "error");
    } finally {
      setReceiptUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    if (!validate()) {
      addToast("Periksa kembali formulir", "error");
      return;
    }
    setSaving(true);
    try {
      let resolvedMerchantId = merchantId || null;
      let resolvedMerchantName = matchedMerchant?.name || merchantInput.trim() || null;
      if (!resolvedMerchantId && resolvedMerchantName) {
        try {
          const savedMerchant = await saveMerchant({ name: resolvedMerchantName });
          resolvedMerchantId = savedMerchant.id;
          resolvedMerchantName = savedMerchant.name;
          setMerchants((prev) => [...prev, savedMerchant]);
        } catch (err) {
          console.warn("Gagal menyimpan merchant", err);
        }
      }

      const payload = {
        date,
        type,
        amount: amountNumber,
        account_id: accountId,
        to_account_id: isTransfer ? toAccountId : null,
        category_id: !isTransfer ? categoryId || null : null,
        merchant_id: resolvedMerchantId,
        title: title.trim() || null,
        notes: notes.trim() || null,
        tags,
        receipt_url: receiptUrl || null,
      };

      const saved = await createTransaction(payload);

      onAdd?.({
        __skipCloud: true,
        ...saved,
        type,
        amount: saved.amount,
        date: saved.date,
        account_id: saved.account_id,
        account: selectedAccount?.name || null,
        to_account_id: saved.to_account_id,
        to_account: selectedToAccount?.name || null,
        category_id: saved.category_id,
        category: selectedCategory?.name || null,
        merchant_id: saved.merchant_id ?? resolvedMerchantId,
        merchant: resolvedMerchantName,
        title: saved.title,
        notes: saved.notes,
        tags: saved.tags ?? tags,
        receipt_url: saved.receipt_url ?? receiptUrl,
      });

      addToast("Transaksi tersimpan", "success");
      resetForm();
      navigate("/transactions");
    } catch (err) {
      console.error(err);
      addToast(err?.message || "Gagal menyimpan transaksi", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <Section first className="mx-auto max-w-5xl">
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
            Memuat formulir...
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      <Section first className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Tambah Transaksi"
          description="Catat arus kas dengan pengalaman modern dan cepat."
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-11 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => navigate(-1)}
            >
              Batal
            </button>
            <button
              type="button"
              className="h-11 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={resetForm}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Reset
            </button>
            <button
              type="submit"
              form={formId}
              className="h-11 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              disabled={!canSubmit || saving}
            >
              {saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 inline h-4 w-4" aria-hidden="true" />}
              Simpan
            </button>
          </div>
        </PageHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <form id={formId} className="space-y-6" onSubmit={handleSubmit}>
            <div className={CARD_CLASS}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex rounded-2xl border border-border bg-muted/40 p-1">
                    {TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const active = type === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          data-active={active}
                          onClick={() => {
                            setType(option.value);
                            setErrors((prev) => ({ ...prev, toAccount: undefined, category: undefined }));
                          }}
                          className={clsx(
                            "flex items-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            "h-9", "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground",
                          )}
                          aria-pressed={active}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" /> {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <DateChips value={date} onSelect={(next) => { setDate(next); setErrors((prev) => ({ ...prev, date: undefined })); }} />
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => {
                        setDate(event.target.value);
                        setErrors((prev) => ({ ...prev, date: undefined }));
                      }}
                      className={INPUT_CLASS}
                      aria-label="Tanggal transaksi"
                    />
                  </div>
                </div>
                <AmountInput
                  id="amount"
                  label="Jumlah"
                  value={amountInput}
                  onChange={(value) => {
                    setAmountInput(value);
                    setErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  placeholder="Masukkan jumlah"
                  helper="Angka otomatis diformat."
                  error={errors.amount}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="account" className="text-sm font-medium text-muted-foreground">
                      Akun sumber
                    </label>
                    <select
                      id="account"
                      value={accountId}
                      onChange={(event) => {
                        setAccountId(event.target.value);
                        setErrors((prev) => ({ ...prev, account: undefined }));
                      }}
                      className={INPUT_CLASS}
                    >
                      <option value="">Pilih akun</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name || "(Tanpa nama)"}
                        </option>
                      ))}
                    </select>
                    {errors.account ? <p className="text-sm text-destructive">{errors.account}</p> : null}
                  </div>
                  {isTransfer ? (
                    <div className="space-y-2">
                      <label htmlFor="toAccount" className="text-sm font-medium text-muted-foreground">
                        Akun tujuan
                      </label>
                      <select
                        id="toAccount"
                        value={toAccountId}
                        onChange={(event) => {
                          setToAccountId(event.target.value);
                          setErrors((prev) => ({ ...prev, toAccount: undefined }));
                        }}
                        className={INPUT_CLASS}
                      >
                        <option value="">Pilih akun tujuan</option>
                        {destinationAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name || "(Tanpa nama)"}
                          </option>
                        ))}
                      </select>
                      {errors.toAccount ? <p className="text-sm text-destructive">{errors.toAccount}</p> : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor="category" className="text-sm font-medium text-muted-foreground">
                        Kategori
                      </label>
                      <select
                        id="category"
                        value={categoryId}
                        onChange={(event) => {
                          setCategoryId(event.target.value);
                          setErrors((prev) => ({ ...prev, category: undefined }));
                        }}
                        className={INPUT_CLASS}
                        disabled={isTransfer}
                      >
                        <option value="">Pilih kategori</option>
                        {(categoriesByType[type] || []).map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {errors.category ? <p className="text-sm text-destructive">{errors.category}</p> : null}
                    </div>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="merchant" className="text-sm font-medium text-muted-foreground">
                      Merchant (opsional)
                    </label>
                    <input
                      id="merchant"
                      list="merchant-options"
                      value={merchantInput}
                      onChange={(event) => setMerchantInput(event.target.value)}
                      placeholder="Toko, vendor, atau pihak terkait"
                      className={INPUT_CLASS}
                    />
                    <datalist id="merchant-options">
                      {merchants.map((merchant) => (
                        <option key={merchant.id} value={merchant.name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium text-muted-foreground">
                      Judul (opsional)
                    </label>
                    <input
                      id="title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Contoh: Kopi sore"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="notes" className="text-sm font-medium text-muted-foreground">
                    Catatan
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Tambahkan detail penting"
                    className={TEXTAREA_CLASS}
                  />
                </div>
                <TagInput
                  id="tags"
                  label="Tags"
                  value={tags}
                  onChange={setTags}
                  helper="Pisahkan dengan koma atau spasi untuk menambah tag baru."
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="receipt">
                    Upload Struk (opsional)
                  </label>
                  <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm">
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Receipt className="h-4 w-4" aria-hidden="true" /> Unggah bukti transaksi sebagai arsip.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label
                        className="h-11 cursor-pointer rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted/40 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary"
                      >
                        <span>{receiptUploading ? "Mengunggah..." : "Pilih file"}</span>
                        <input
                          id="receipt"
                          type="file"
                          className="sr-only"
                          onChange={(event) => handleUploadReceipt(event.target.files?.[0] || null)}
                          accept="image/*,application/pdf"
                          disabled={receiptUploading}
                        />
                      </label>
                      {receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => setReceiptUrl("")}
                          className="text-sm font-medium text-destructive underline-offset-2 hover:underline"
                        >
                          Hapus struk
                        </button>
                      ) : null}
                    </div>
                    {receiptUrl ? (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Lihat struk
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" className="sr-only" aria-hidden="true">
              Simpan
            </button>
          </form>

          <aside className="space-y-4">
            <div className={CARD_CLASS}>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ringkasan arus kas</p>
                    <p className="text-xs text-muted-foreground">Pantau sumber dan tujuan dana secara instan.</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tipe</span>
                    <span className="font-semibold text-foreground">{TYPE_OPTIONS.find((opt) => opt.value === type)?.label}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Jumlah</span>
                    <span className="font-semibold text-foreground">{formatCurrency(amountNumber)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tanggal</span>
                    <span className="font-semibold text-foreground">{date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Akun sumber</span>
                    <span className="font-semibold text-foreground">{selectedAccount?.name || "Belum dipilih"}</span>
                  </div>
                  {isTransfer ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Akun tujuan</span>
                      <span className="font-semibold text-foreground">{selectedToAccount?.name || "Belum dipilih"}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Kategori</span>
                      <span className="font-semibold text-foreground">{selectedCategory?.name || "Belum dipilih"}</span>
                    </div>
                  )}
                  {tags.length > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tags</span>
                      <span className="font-semibold text-foreground">{tags.join(", ")}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={CARD_CLASS}>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="font-semibold">Tips pengisian</span>
                </div>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Kategori otomatis disembunyikan saat mode Transfer.</li>
                  <li>Pastikan akun tujuan berbeda untuk menghindari duplikasi.</li>
                  <li>Upload struk untuk memudahkan audit dan bukti transaksi.</li>
                </ul>
              </div>
            </div>

            <div className={CARD_CLASS}>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground">
                  <TagIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="font-semibold">Kontrol cepat</span>
                </div>
                <p>Enter = Simpan, Esc = Batal. Gunakan Tab untuk berpindah field lebih cepat.</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  <span>Mode Transfer akan mengunci kategori.</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </Page>
  );
}
