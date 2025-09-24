import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Modal from "../Modal";
import Input from "../ui/Input";
import Select from "../ui/Select";
import type { AccountPayload, AccountType } from "../../lib/api";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Tunai" },
  { value: "bank", label: "Bank" },
  { value: "ewallet", label: "Dompet Digital" },
  { value: "other", label: "Lainnya" },
];

const DEFAULT_FORM: AccountPayload = {
  name: "",
  type: "cash",
  currency: "IDR",
};

interface AccountFormModalProps {
  open: boolean;
  title?: string;
  initialValue?: Partial<AccountPayload>;
  submitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (values: AccountPayload) => void;
}

export default function AccountFormModal({
  open,
  title = "Tambah Akun",
  initialValue,
  submitting = false,
  errorMessage,
  onClose,
  onSubmit,
}: AccountFormModalProps) {
  const [form, setForm] = useState<AccountPayload>(DEFAULT_FORM);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...DEFAULT_FORM,
      ...initialValue,
      name: initialValue?.name ?? DEFAULT_FORM.name,
      type: (initialValue?.type as AccountType) ?? DEFAULT_FORM.type,
      currency: initialValue?.currency ?? DEFAULT_FORM.currency,
    });
  }, [open, initialValue]);

  const typeOptions = useMemo(() => TYPE_OPTIONS, []);

  const handleChange = (field: keyof AccountPayload) =>
    (value: string) => {
      setForm((prev) => ({
        ...prev,
        [field]:
          field === "currency"
            ? value.toUpperCase()
            : field === "type"
              ? (value as AccountType)
              : value,
      }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      name: form.name,
      type: form.type,
      currency: form.currency,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Nama Akun"
          value={form.name}
          onChange={(event) => handleChange("name")(event.target.value)}
          required
          placeholder="Nama akun"
        />
        <Select
          label="Jenis Akun"
          value={form.type}
          onChange={(event) => handleChange("type")(event.target.value)}
          options={typeOptions}
          placeholder="Pilih jenis"
          required
        />
        <Input
          label="Mata Uang"
          value={form.currency ?? ""}
          onChange={(event) => handleChange("currency")(event.target.value)}
          helper="Gunakan kode mata uang 3 huruf (mis. IDR, USD)."
          maxLength={3}
          placeholder="IDR"
        />
        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
