import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Repeat,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import Page from "../layout/Page";
import PageHeader from "../layout/PageHeader";
import Section from "../layout/Section";
import Card, { CardBody, CardFooter, CardHeader } from "../components/Card";
import Segmented from "../components/ui/Segmented";
import CurrencyInput from "../components/ui/CurrencyInput";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import AccountFormModal from "../components/accounts/AccountFormModal";
import Textarea from "../components/ui/Textarea";
import { listCategories, listMerchants, saveMerchant } from "../lib/api";
import { createAccount, listAccounts as fetchAccounts } from "../lib/api.ts";
import { supabase } from "../lib/supabase.js";
import { useToast } from "../context/ToastContext";

const TEMPLATE_KEY = "hw:txTemplates";
const ADD_ACCOUNT_OPTION_VALUE = "__add_account__";

function templateStorage(initial = []) {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return initial;
    return parsed;
  } catch (err) {
    console.warn("Failed to parse templates", err);
    return initial;
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}

function buildIsoDate(date, time) {
  if (!date) return new Date().toISOString();
  if (!time) return new Date(`${date}T00:00`).toISOString();
  return new Date(`${date}T${time}`).toISOString();
}

function defaultTime() {
  return new Date().toISOString().slice(11, 16);
}

function nextId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export default function TransactionAdd({ onAdd }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(defaultTime);
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [toAccountName, setToAccountName] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantInput, setMerchantInput] = useState("");
  const [merchantSaving, setMerchantSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [pending, setPending] = useState(false);
  const [attachments, setAttachments] = useState(() => [{ id: nextId(), url: "" }]);
  const [categories, setCategories] = useState([]);
  const [userId, setUserId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [templates, setTemplates] = useState(() => templateStorage([]));
  const [templateName, setTemplateName] = useState("");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalBusy, setAccountModalBusy] = useState(false);
  const [accountModalError, setAccountModalError] = useState("");
  const [accountModalTarget, setAccountModalTarget] = useState("source");
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  useEffect(() => {
    async function loadMasterData() {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          throw userError;
        }
        const uid = userData.user?.id;
        if (!uid) {
          throw new Error("Anda harus login untuk membuat transaksi.");
        }
        setUserId(uid);

        const [catRows, accountRows, merchantRows] = await Promise.all([
          listCategories(),
          fetchAccounts(uid),
          listMerchants(),
        ]);
        setCategories(catRows);
        const sortedAccounts = [...accountRows].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" }),
        );
        setAccounts(sortedAccounts);
        setMerchants(merchantRows);
        if (sortedAccounts.length) {
          setAccountId(sortedAccounts[0].id);
          setAccountName(sortedAccounts[0].name);
        }
      } catch (err) {
        console.error(err);
        addToast(`Gagal memuat data master: ${err.message}`, "error");
      } finally {
        setLoading(false);
      }
    }
    loadMasterData();
  }, [addToast]);

  const categoriesByType = useMemo(() => {
    const map = { income: [], expense: [], transfer: [] };
    (categories || []).forEach((cat) => {
      const key = (cat.type || "expense").toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(cat);
    });
    return map;
  }, [categories]);

  useEffect(() => {
    const list = categoriesByType[type] || [];
    if (list.length === 0) {
      setCategoryId("");
      setCategoryName("");
      return;
    }
    if (!list.some((c) => c.id === categoryId)) {
      setCategoryId(list[0].id);
      setCategoryName(list[0].name);
    }
  }, [categoriesByType, categoryId, type]);

  useEffect(() => {
    if (type !== "transfer") {
      setToAccountId("");
      setToAccountName("");
    } else if (toAccountId && toAccountId === accountId) {
      setToAccountId("");
      setToAccountName("");
    }
  }, [type, accountId, toAccountId]);

  useEffect(() => {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  }, [templates]);

  const openAccountModal = useCallback((target = "source") => {
    setAccountModalTarget(target);
    setAccountModalError("");
    setAccountModalOpen(true);
  }, []);

  const closeAccountModal = useCallback(() => {
    setAccountModalOpen(false);
    setAccountModalError("");
    setAccountModalTarget("source");
  }, []);

  const guardedCloseAccountModal = useCallback(() => {
    if (!accountModalBusy) {
      closeAccountModal();
    }
  }, [accountModalBusy, closeAccountModal]);

  const handleAccountCreate = async (values) => {
    setAccountModalBusy(true);
    setAccountModalError("");
    try {
      let uid = userId;
      if (!uid) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          throw userError;
        }
        uid = userData.user?.id;
        if (!uid) {
          throw new Error("Anda harus login untuk menambah akun.");
        }
        setUserId(uid);
      }

      const created = await createAccount(uid, values);
      addToast("Akun ditambahkan", "success");

      try {
        const refreshed = await fetchAccounts(uid);
        const sorted = [...refreshed].sort((a, b) => (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" }));
        setAccounts(sorted);
      } catch {
        const merged = [...accounts.filter((acc) => acc.id !== created.id), created];
        merged.sort((a, b) => (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" }));
        setAccounts(merged);
      }

      const createdName = created.name || "";
      if (accountModalTarget === "destination") {
        setToAccountId(created.id);
        setToAccountName(createdName);
        if (created.id === accountId) {
          setAccountName(createdName);
        }
      } else {
        setAccountId(created.id);
        setAccountName(createdName);
        if (type === "transfer" && created.id === toAccountId) {
          setToAccountId("");
          setToAccountName("");
        }
      }

      closeAccountModal();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Gagal menambah akun. Silakan coba lagi.";
      setAccountModalError(message);
    } finally {
      setAccountModalBusy(false);
    }
  };

  const accountOptions = useMemo(() => {
    const options = accounts.map((acc) => ({ value: acc.id, label: acc.name || "(Tanpa Nama)" }));
    options.push({ value: ADD_ACCOUNT_OPTION_VALUE, label: "+ Tambah Akun…" });
    return options;
  }, [accounts]);

  const toAccountOptions = useMemo(() => {
    const options = accounts
      .filter((acc) => acc.id !== accountId)
      .map((acc) => ({ value: acc.id, label: acc.name || "(Tanpa Nama)" }));
    options.push({ value: ADD_ACCOUNT_OPTION_VALUE, label: "+ Tambah Akun…" });
    return options;
  }, [accounts, accountId]);

  const categoryOptions = useMemo(() => {
    return (categoriesByType[type] || []).map((cat) => ({ value: cat.id, label: cat.name }));
  }, [categoriesByType, type]);

  const merchantOptions = useMemo(
    () => merchants.map((m) => ({ value: m.id, label: m.name || "(Tanpa Nama)" })),
    [merchants],
  );

  const presetAmounts = [25000, 50000, 100000, 200000, 500000];

  const repeatLabels = {
    none: "Tidak ada",
    weekly: "Setiap minggu",
    monthly: "Setiap bulan",
    yearly: "Setiap tahun",
  };

  const applyTemplate = (template) => {
    if (!template) return;
    setType(template.type || "expense");
    setAmount(template.amount || 0);
    if (template.date) setDate(template.date);
    if (template.time) setTime(template.time);
    setCategoryId(template.category_id || "");
    setCategoryName(template.category_name || "");
    setAccountId(template.account_id || "");
    setAccountName(template.account_name || "");
    setToAccountId(template.to_account_id || "");
    setToAccountName(template.to_account_name || "");
    setMerchantId(template.merchant_id || "");
    setMerchantName(template.merchant_name || "");
    setTitle(template.title || "");
    setNote(template.note || "");
    setRepeat(template.repeat || "none");
    setPending(Boolean(template.pending));
    setAttachments(template.attachments?.length ? template.attachments : [{ id: nextId(), url: "" }]);
  };

  const resetForm = () => {
    setAmount(0);
    setTitle("");
    setNote("");
    setRepeat("none");
    setPending(false);
    setAttachments([{ id: nextId(), url: "" }]);
    setMerchantId("");
    setMerchantName("");
    setMerchantInput("");
    setTime(defaultTime());
  };

  const handleAddAttachmentRow = () => {
    setAttachments((prev) => [...prev, { id: nextId(), url: "" }]);
  };

  const handleAttachmentChange = (id, field, value) => {
    setAttachments((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      return filtered.length ? filtered : [{ id: nextId(), url: "" }];
    });
  };

  const handleSaveMerchant = async () => {
    const name = (merchantInput || "").trim();
    if (!name) return;
    setMerchantSaving(true);
    try {
      const saved = await saveMerchant({ name, category_id: categoryId || null, notes: null });
      setMerchants((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      setMerchantId(saved.id);
      setMerchantName(saved.name);
      setMerchantInput("");
      addToast("Merchant baru disimpan", "success");
    } catch (err) {
      addToast(`Gagal menyimpan merchant: ${err.message}`, "error");
    } finally {
      setMerchantSaving(false);
    }
  };

  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name) {
      addToast("Nama template wajib diisi", "error");
      return;
    }
    const entry = {
      id: nextId(),
      name,
      type,
      amount,
      date,
      time,
      category_id: categoryId,
      category_name: categoryName,
      account_id: accountId,
      account_name: accountName,
      to_account_id: toAccountId,
      to_account_name: toAccountName,
      merchant_id: merchantId,
      merchant_name: merchantName,
      title,
      note,
      repeat,
      pending,
      attachments,
    };
    setTemplates((prev) => [...prev, entry]);
    setTemplateName("");
    addToast("Template transaksi disimpan", "success");
  };

  const handleRemoveTemplate = (id) => {
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  };

  const receiptsPayload = attachments
    .map((item) => ({
      id: item.id,
      url: (item.url || "").trim(),
    }))
    .filter((item) => item.url);

  const canSubmit =
    amount > 0 &&
    categoryId &&
    (!isTransfer() || (toAccountId && toAccountId !== accountId));

  function isTransfer() {
    return type === "transfer";
  }

  const summary = [
    { label: "Tipe", value: type === "income" ? "Pemasukan" : type === "expense" ? "Pengeluaran" : "Transfer" },
    { label: "Jumlah", value: formatCurrency(amount) },
    { label: "Tanggal", value: `${date}${time ? ` • ${time}` : ""}` },
    { label: "Kategori", value: categoryName || "-" },
    { label: "Akun", value: accountName || "-" },
    isTransfer() ? { label: "Ke Akun", value: toAccountName || "-" } : null,
    { label: "Merchant", value: merchantName || "-" },
    { label: "Status", value: pending ? "Menunggu konfirmasi" : "Selesai" },
    repeat !== "none" ? { label: "Pengulangan", value: repeatLabels[repeat] } : null,
  ].filter(Boolean);

  const quickDate = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().slice(0, 10));
  };

  const handleSubmit = async (redirect = "list") => {
    if (!canSubmit) {
      addToast("Lengkapi data utama terlebih dahulu", "error");
      return;
    }
    setSaving(true);
    try {
      const noteParts = [];
      if (pending) noteParts.push("[Pending]");
      if (note.trim()) noteParts.push(note.trim());
      if (repeat !== "none") noteParts.push(`[Recurring: ${repeatLabels[repeat]}]`);
      const combinedNote = noteParts.join("\n");
      const payload = {
        type,
        amount,
        date: buildIsoDate(date, time),
        category: categoryName,
        category_id: categoryId,
        account_id: accountId,
        account_name: accountName,
        to_account_id: isTransfer() ? toAccountId : null,
        to_account_name: toAccountName,
        merchant_id: merchantId || null,
        merchant_name: merchantName,
        title: title || null,
        note: combinedNote,
        notes: combinedNote,
        receipts: receiptsPayload,
      };
      await onAdd(payload);
      addToast("Transaksi berhasil disimpan", "success");
      if (redirect === "stay") {
        resetForm();
      } else {
        navigate("/transactions");
      }
    } catch (err) {
      addToast(`Gagal menyimpan transaksi: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <Section first className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center py-20 text-muted gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Memuat formulir...
          </div>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Tambah Riwayat Transaksi"
        description="Catat pengeluaran, pemasukan, transfer atau transaksi berulang dengan detail lengkap"
      >
        <button type="button" className="btn" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>
      </PageHeader>
      <Section first className="max-w-5xl mx-auto space-y-6">
        {offline && (
          <div className="rounded-xl border border-dashed border-amber-400 bg-amber-100 px-4 py-3 text-sm text-amber-700">
            Kamu sedang offline. Data akan disimpan ke antrian dan dikirim ke server saat koneksi kembali normal.
          </div>
        )}
        <Card>
          <CardHeader
            title="Informasi Utama"
            subtext="Isi data dasar transaksi. Gunakan tombol preset untuk mempercepat pengisian."
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <Segmented
                value={type}
                onChange={setType}
                options={[
                  { label: "Pengeluaran", value: "expense" },
                  { label: "Pemasukan", value: "income" },
                  { label: "Transfer", value: "transfer" },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                {presetAmounts.map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="btn text-xs"
                    onClick={() => setAmount((prev) => prev + val)}
                  >
                    +{formatCurrency(val)}
                  </button>
                ))}
                <button type="button" className="btn text-xs" onClick={() => setAmount(0)}>
                  Reset
                </button>
              </div>
            </div>
            <CurrencyInput label="Jumlah" value={amount} onChangeNumber={setAmount} />
            <div className="grid gap-4 md:grid-cols-2">
              <Input type="date" label="Tanggal" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input type="time" label="Waktu" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Preset:
              </span>
              <button type="button" className="btn text-xs" onClick={() => quickDate(0)}>
                Hari ini
              </button>
              <button type="button" className="btn text-xs" onClick={() => quickDate(-1)}>
                Kemarin
              </button>
              <button type="button" className="btn text-xs" onClick={() => quickDate(-7)}>
                7 hari lalu
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Akun sumber"
                value={accountId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === ADD_ACCOUNT_OPTION_VALUE) {
                    openAccountModal("source");
                    return;
                  }
                  setAccountId(val);
                  const selected = accounts.find((acc) => acc.id === val);
                  setAccountName(selected?.name || "");
                }}
                options={accountOptions}
                placeholder="Pilih akun (opsional)"
              />
              {isTransfer() && (
                <Select
                  label="Akun tujuan"
                  value={toAccountId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === ADD_ACCOUNT_OPTION_VALUE) {
                      openAccountModal("destination");
                      return;
                    }
                    setToAccountId(val);
                    const selected = accounts.find((acc) => acc.id === val);
                    setToAccountName(selected?.name || "");
                  }}
                  options={toAccountOptions}
                  placeholder="Pilih akun"
                />
              )}
            </div>
            {accounts.length === 0 && (
              <p className="text-xs text-muted">
                Belum ada akun tersimpan. Transaksi akan dicatat tanpa informasi akun.
              </p>
            )}
            <Select
              label="Kategori"
              value={categoryId}
              onChange={(e) => {
                const val = e.target.value;
                setCategoryId(val);
                const selected = categories.find((cat) => cat.id === val);
                setCategoryName(selected?.name || "");
              }}
              options={categoryOptions}
              placeholder="Pilih kategori"
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Rincian Tambahan"
            subtext="Perkaya catatan dengan merchant, judul, dan catatan agar mudah dilacak."
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Merchant"
                value={merchantId}
                onChange={(e) => {
                  const val = e.target.value;
                  setMerchantId(val);
                  const selected = merchants.find((m) => m.id === val);
                  setMerchantName(selected?.name || "");
                }}
                options={merchantOptions}
                placeholder="Pilih merchant"
              />
              <div className="space-y-2">
                <Input
                  label="Tambah merchant baru"
                  value={merchantInput}
                  onChange={(e) => setMerchantInput(e.target.value)}
                  placeholder="Nama merchant"
                />
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={handleSaveMerchant}
                  disabled={merchantSaving}
                >
                  {merchantSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan merchant
                </button>
              </div>
            </div>
            <Input label="Judul singkat" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Makan siang tim" />
            <Textarea
              label="Catatan"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tambahkan detail penting, nomor invoice, dsb"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Repeat className="h-4 w-4" /> Penjadwalan
                </label>
                <Select
                  label="Frekuensi"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  options={[
                    { value: "none", label: repeatLabels.none },
                    { value: "weekly", label: repeatLabels.weekly },
                    { value: "monthly", label: repeatLabels.monthly },
                    { value: "yearly", label: repeatLabels.yearly },
                  ]}
                />
              </div>
              <label className="flex items-center gap-2 text-sm mt-6">
                <input
                  type="checkbox"
                  checked={pending}
                  onChange={(e) => setPending(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Tandai sebagai transaksi pending / menunggu konfirmasi
              </label>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Lampiran"
            subtext="Simpan bukti pembayaran atau tautan invoice untuk referensi cepat."
          />
          <CardBody className="space-y-3">
            {attachments.map((item) => (
              <div key={item.id} className="flex gap-2">
                <Input
                  label="URL bukti transaksi"
                  value={item.url}
                  onChange={(e) => handleAttachmentChange(item.id, "url", e.target.value)}
                  placeholder="https://"
                />
                <button type="button" className="btn" onClick={() => handleRemoveAttachment(item.id)}>
                  <RefreshCcw className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={handleAddAttachmentRow}>
              <Upload className="h-4 w-4" /> Tambah tautan bukti
            </button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Template & Otomatisasi"
            subtext="Simpan konfigurasi favorit agar pengisian berikutnya cukup satu klik."
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nama template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Contoh: Makan siang tim"
              />
              <button type="button" className="btn btn-primary mt-6" onClick={handleSaveTemplate}>
                <Sparkles className="h-4 w-4" /> Simpan sebagai template
              </button>
            </div>
            {templates.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{tpl.name}</span>
                      <button type="button" className="text-xs text-danger" onClick={() => handleRemoveTemplate(tpl.id)}>
                        Hapus
                      </button>
                    </div>
                    <div className="text-xs text-muted">{formatCurrency(tpl.amount)} • {tpl.category_name || "Tanpa kategori"}</div>
                    <button type="button" className="btn btn-secondary w-full" onClick={() => applyTemplate(tpl)}>
                      Terapkan template
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted flex items-center gap-2">
                <FileText className="h-4 w-4" /> Belum ada template tersimpan.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ringkasan" subtext="Tinjau kembali sebelum menyimpan." />
          <CardBody className="space-y-2">
            <ul className="grid gap-2 md:grid-cols-2">
              {summary.map((row) => (
                <li key={row.label} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="text-xs text-muted uppercase">{row.label}</span>
                  <div className="font-medium">{row.value}</div>
                </li>
              ))}
            </ul>
          </CardBody>
          <CardFooter className="flex flex-wrap justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted">
              <Check className="h-4 w-4 text-brand-var" /> Formulir otomatis menyimpan preferensi terakhir.
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => handleSubmit("stay")} disabled={!canSubmit || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan & tambah lagi
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSubmit("list")}
                disabled={!canSubmit || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan transaksi
              </button>
            </div>
          </CardFooter>
        </Card>
      </Section>
      <AccountFormModal
        open={accountModalOpen}
        mode="create"
        busy={accountModalBusy}
        error={accountModalError || null}
        onClose={guardedCloseAccountModal}
        onSubmit={handleAccountCreate}
      />
    </Page>
  );
}
