import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Page from "../layout/Page";
import PageHeader from "../layout/PageHeader";
import Section from "../layout/Section";
import Card, { CardBody, CardHeader } from "../components/Card";
import AccountFormModal from "../components/accounts/AccountFormModal";
import { useToast } from "../context/ToastContext";
import {
  AccountPayload,
  AccountRecord,
  AccountType,
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
} from "../lib/api";

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

const TYPE_LABELS: Record<AccountType, string> = {
  cash: "Tunai",
  bank: "Bank",
  ewallet: "Dompet Digital",
  other: "Lainnya",
};

type FilterType = "all" | AccountType;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "cash", label: "Tunai" },
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "Dompet Digital" },
  { value: "other", label: "Lainnya" },
];

function formatCreatedAt(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Accounts() {
  const { addToast } = useToast();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");

  const refreshAccounts = useCallback(async () => {
    const rows = await listAccounts();
    setAccounts(rows);
    return rows;
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshAccounts();
    } catch (err) {
      setError(toErrorMessage(err, "Gagal memuat daftar akun. Coba lagi."));
    } finally {
      setLoading(false);
    }
  }, [refreshAccounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    if (filterType === "all") return accounts;
    return accounts.filter((account) => account.type === filterType);
  }, [accounts, filterType]);

  const handleOpenCreate = useCallback(() => {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }, []);

  const handleOpenEdit = useCallback((account: AccountRecord) => {
    setEditing(account);
    setFormError(null);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setFormError(null);
    setEditing(null);
  }, []);

  const handleSubmitAccount = useCallback(
    async (values: AccountPayload) => {
      setSubmitting(true);
      setFormError(null);
      try {
        if (editing) {
          await updateAccount(editing.id, values);
          await refreshAccounts();
          addToast("Perubahan akun disimpan", "success");
        } else {
          await createAccount(values);
          await refreshAccounts();
          addToast("Akun ditambahkan", "success");
        }
        handleCloseModal();
      } catch (err) {
        setFormError(
          toErrorMessage(
            err,
            editing ? "Gagal memperbarui akun. Coba lagi." : "Gagal menambahkan akun. Coba lagi.",
          ),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [addToast, editing, handleCloseModal, refreshAccounts],
  );

  const handleDeleteAccount = useCallback(
    async (account: AccountRecord) => {
      const confirmed = window.confirm(
        `Hapus akun "${account.name || "Tanpa Nama"}"? Tindakan ini tidak dapat dibatalkan.`,
      );
      if (!confirmed) return;
      try {
        await deleteAccount(account.id);
        setAccounts((prev) => prev.filter((item) => item.id !== account.id));
        addToast("Akun dihapus", "success");
      } catch (err) {
        addToast(toErrorMessage(err, "Gagal menghapus akun. Coba lagi."), "error");
      }
    },
    [addToast],
  );

  const currentInitialValue = useMemo(() => {
    if (!editing) return undefined;
    return {
      name: editing.name,
      type: editing.type,
      currency: editing.currency,
    } satisfies AccountPayload;
  }, [editing]);

  return (
    <Page>
      <PageHeader
        title="Akun"
        description="Kelola akun sumber dana untuk transaksi Anda."
      >
        <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" /> Tambah Akun
        </button>
      </PageHeader>
      <Section first className="space-y-6">
        <Card>
          <CardHeader
            title="Daftar Akun"
            subtext="Tambahkan, ubah, atau hapus akun sesuai kebutuhan."
          />
          <CardBody className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilterType(option.value)}
                  className={clsx(
                    "inline-flex h-9 items-center rounded-full border px-4 text-xs font-semibold transition-colors",
                    filterType === option.value
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border-subtle text-muted hover:text-text",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface-alt/60 p-6 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat akun…
              </div>
            ) : error ? (
              <div className="space-y-3 rounded-2xl border border-danger/30 bg-danger/5 p-6 text-sm text-danger">
                <p>{error}</p>
                <button type="button" className="btn btn-sm" onClick={loadAccounts}>
                  Coba lagi
                </button>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="rounded-2xl border border-border-subtle bg-surface-alt/60 p-6 text-sm text-muted">
                {accounts.length === 0
                  ? "Belum ada akun tersimpan. Tambahkan akun pertama Anda."
                  : "Tidak ada akun untuk filter yang dipilih."}
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredAccounts.map((account) => {
                  const displayName = account.name || "(Tanpa Nama)";
                  return (
                    <li
                      key={account.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-text">{displayName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="badge">{TYPE_LABELS[account.type]}</span>
                            <span className="badge-muted uppercase">{account.currency || "IDR"}</span>
                            <span>Dibuat {formatCreatedAt(account.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleOpenEdit(account)}
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteAccount(account)}
                        >
                          <Trash2 className="h-4 w-4" /> Hapus
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </Section>
      <AccountFormModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitAccount}
        submitting={submitting}
        errorMessage={formError}
        title={editing ? "Edit Akun" : "Tambah Akun"}
        initialValue={currentInitialValue}
      />
    </Page>
  );
}
