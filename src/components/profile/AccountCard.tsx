import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, Loader2, UploadCloud } from 'lucide-react';

const inputStyles =
  'h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text-primary shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60';

const labelStyles = 'text-sm font-medium text-text-primary';

const helperTextStyles = 'text-xs text-text-muted';

type AccountCardProps = {
  fullName: string | null;
  username: string | null;
  email: string;
  avatarUrl: string | null;
  pending: boolean;
  disabled?: boolean;
  onSave: (payload: { full_name: string | null; username: string | null }) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onValidateUsername: (username: string) => Promise<boolean>;
};

type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function AccountCard({
  fullName,
  username,
  email,
  avatarUrl,
  pending,
  disabled = false,
  onSave,
  onUploadAvatar,
  onValidateUsername,
}: AccountCardProps) {
  const [nameInput, setNameInput] = useState(fullName ?? '');
  const [usernameInput, setUsernameInput] = useState(username ?? '');
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setNameInput(fullName ?? '');
  }, [fullName]);

  useEffect(() => {
    setUsernameInput(username ?? '');
    setUsernameState('idle');
  }, [username]);

  useEffect(() => {
    setPreviewUrl(avatarUrl ?? null);
  }, [avatarUrl]);

  useEffect(() => {
    if (!dirty) return;
    if (!usernameInput) {
      setUsernameState('idle');
      return;
    }
    const trimmed = usernameInput.trim().toLowerCase();
    const regex = /^[a-z0-9_]{3,30}$/;
    if (!regex.test(trimmed)) {
      setUsernameState('invalid');
      return;
    }
    let cancelled = false;
    setUsernameState('checking');
    const timeout = setTimeout(() => {
      onValidateUsername(trimmed)
        .then((available) => {
          if (cancelled) return;
          setUsernameState(available ? 'available' : 'taken');
        })
        .catch(() => {
          if (cancelled) return;
          setUsernameState('idle');
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [usernameInput, dirty, onValidateUsername]);

  const avatarClasses = useMemo(
    () =>
      clsx(
        'relative flex aspect-square w-24 items-center justify-center overflow-hidden rounded-3xl border border-border-subtle bg-surface-alt text-text-muted shadow-sm transition focus-within:ring-2 focus-within:ring-ring-primary',
        uploading && 'opacity-75'
      ),
    [uploading]
  );

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);
    try {
      await onUploadAvatar(file);
    } catch (err) {
      setError((err as Error).message ?? 'Gagal mengunggah avatar.');
      setPreviewUrl(avatarUrl ?? null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      void handleFile(file);
    }
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled || pending) return;
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      void handleFile(file);
    }
  };

  const openFileDialog = () => {
    if (disabled || pending) return;
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || pending) return;
    setError(null);
    setDirty(true);
    try {
      await onSave({
        full_name: nameInput.trim() ? nameInput.trim() : null,
        username: usernameInput.trim() ? usernameInput.trim().toLowerCase() : null,
      });
    } catch (err) {
      setError((err as Error).message ?? 'Tidak bisa menyimpan profil.');
      return;
    }
    setDirty(false);
  };

  const usernameMessage = useMemo(() => {
    switch (usernameState) {
      case 'checking':
        return 'Memeriksa ketersediaan…';
      case 'available':
        return 'Username tersedia!';
      case 'taken':
        return 'Username sudah digunakan.';
      case 'invalid':
        return 'Gunakan 3-30 karakter huruf, angka, atau underscore.';
      default:
        return 'Huruf kecil otomatis. Hanya huruf, angka, underscore.';
    }
  }, [usernameState]);

  return (
    <section aria-labelledby="account-settings-heading" className="rounded-3xl border border-border-subtle bg-surface p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="account-settings-heading" className="text-lg font-semibold text-text-primary">
            Informasi Akun
          </h2>
          <p className="text-sm text-text-muted">Perbarui nama, username, dan avatar kamu.</p>
        </div>
        <div className="flex items-center gap-3">
          <label
            className={clsx(
              avatarClasses,
              'cursor-pointer',
              (disabled || pending) && 'cursor-not-allowed opacity-60'
            )}
            htmlFor="avatar-input"
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={handleDrop}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Avatar pengguna"
                className="h-full w-full object-cover"
                onError={() => setPreviewUrl(null)}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-xs">
                <Camera className="h-5 w-5" aria-hidden="true" />
                <span>Unggah</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              id="avatar-input"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="sr-only"
              onChange={onFileChange}
              disabled={disabled || pending}
            />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              </div>
            )}
          </label>
          <button
            type="button"
            onClick={openFileDialog}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface-alt px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-alt/70 focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || pending}
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Ganti Avatar
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="col-span-1">
          <label htmlFor="full-name" className={labelStyles}>
            Nama Lengkap
          </label>
          <input
            id="full-name"
            name="full_name"
            value={nameInput}
            onChange={(event) => {
              setNameInput(event.target.value);
              setDirty(true);
            }}
            className={inputStyles}
            placeholder="Nama kamu"
            disabled={disabled || pending}
            aria-describedby="full-name-hint"
          />
          <p id="full-name-hint" className={helperTextStyles}>
            Tampilkan nama lengkap di aplikasi.
          </p>
        </div>

        <div className="col-span-1">
          <label htmlFor="username" className={labelStyles}>
            Username / Handle
          </label>
          <input
            id="username"
            name="username"
            value={usernameInput}
            onChange={(event) => {
              setUsernameInput(event.target.value);
              setDirty(true);
            }}
            className={inputStyles}
            placeholder="misal: hematwoi"
            disabled={disabled || pending}
            aria-describedby="username-status"
            aria-invalid={usernameState === 'invalid' || usernameState === 'taken'}
            autoComplete="off"
          />
          <p
            id="username-status"
            className={clsx(helperTextStyles, usernameState === 'taken' && 'text-danger', usernameState === 'available' && 'text-success')}
            aria-live="polite"
          >
            {usernameMessage}
          </p>
        </div>

        <div className="col-span-2">
          <label htmlFor="email" className={labelStyles}>
            Email
          </label>
          <input
            id="email"
            value={email}
            className={clsx(inputStyles, 'cursor-not-allowed')}
            readOnly
            aria-readonly="true"
          />
          <p className={helperTextStyles}>Email terhubung dari Supabase Auth.</p>
        </div>

        {error && (
          <div className="col-span-2 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <div className="col-span-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || pending}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Simpan Perubahan
          </button>
        </div>
      </form>
    </section>
  );
}
