import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../Modal.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import type { AccountType } from '../../lib/api';

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Tunai' },
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'other', label: 'Lainnya' },
];

export interface AccountFormValues {
  name: string;
  type: AccountType;
  currency: string;
}

interface AccountFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues?: Partial<AccountFormValues>;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<void> | void;
}

export default function AccountFormModal({
  open,
  mode,
  initialValues,
  busy = false,
  error,
  onClose,
  onSubmit,
}: AccountFormModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [currency, setCurrency] = useState('IDR');
  const [formError, setFormError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialValues?.name ?? '');
    setType(initialValues?.type ?? 'cash');
    setCurrency(initialValues?.currency ?? 'IDR');
    setFormError(null);
    setNameTouched(false);
  }, [open, initialValues?.name, initialValues?.type, initialValues?.currency]);

  useEffect(() => {
    if (error) {
      setFormError(error);
    }
  }, [error]);

  const selectOptions = useMemo(() => ACCOUNT_TYPE_OPTIONS, []);
  const title = mode === 'create' ? 'Tambah Akun' : 'Edit Akun';
  const submitLabel = mode === 'create' ? 'Simpan' : 'Simpan perubahan';
  const trimmedName = name.trim();
  const isNameValid = trimmedName.length > 0;
  const nameError = nameTouched && !isNameValid ? 'Nama akun wajib diisi.' : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const nextName = name.trim();
    if (!nextName) {
      setNameTouched(true);
      setFormError('Nama akun wajib diisi.');
      return;
    }

    const trimmedCurrency = currency.trim() || 'IDR';

    try {
      setFormError(null);
      await onSubmit({ name: nextName, type, currency: trimmedCurrency });
    } catch (err) {
      if (err instanceof Error && err.message) {
        setFormError(err.message);
      } else if (typeof err === 'string') {
        setFormError(err);
      } else {
        setFormError('Terjadi kesalahan saat menyimpan akun.');
      }
    }
  };

  const showFormError = formError && formError !== nameError ? formError : null;

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Nama akun"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!nameTouched) {
              setNameTouched(true);
            }
            if (formError) {
              setFormError(null);
            }
          }}
          onBlur={() => setNameTouched(true)}
          placeholder="Nama akun"
          required
          error={nameError ?? undefined}
        />
        <Select
          label="Tipe akun"
          value={type}
          onChange={(event) => setType(event.target.value as AccountType)}
          options={selectOptions}
          placeholder="Pilih tipe akun"
        />
        <Input
          label="Mata uang"
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value.toUpperCase());
            if (formError && formError === 'Nama akun wajib diisi.') {
              setFormError(null);
            }
          }}
          placeholder="IDR"
          maxLength={10}
        />
        {showFormError ? <p className="text-sm font-medium text-danger">{showFormError}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !isNameValid}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
