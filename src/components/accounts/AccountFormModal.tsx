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
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialValues?.name ?? '');
    setType(initialValues?.type ?? 'cash');
    setCurrency(initialValues?.currency ?? 'IDR');
    setLocalError(null);
  }, [open, initialValues?.name, initialValues?.type, initialValues?.currency]);

  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);

  const selectOptions = useMemo(() => ACCOUNT_TYPE_OPTIONS, []);
  const title = mode === 'create' ? 'Tambah Akun' : 'Edit Akun';
  const submitLabel = mode === 'create' ? 'Simpan' : 'Simpan perubahan';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError('Nama akun wajib diisi.');
      return;
    }

    const trimmedCurrency = currency.trim() || 'IDR';

    try {
      setLocalError(null);
      await onSubmit({ name: trimmedName, type, currency: trimmedCurrency });
    } catch (err) {
      if (err instanceof Error && err.message) {
        setLocalError(err.message);
      } else if (typeof err === 'string') {
        setLocalError(err);
      } else {
        setLocalError('Terjadi kesalahan saat menyimpan akun.');
      }
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input label="Nama akun" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama akun" required />
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
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          placeholder="IDR"
          maxLength={10}
        />
        {localError ? <p className="text-sm font-medium text-danger">{localError}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
