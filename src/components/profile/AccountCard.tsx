import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfileRecord } from '../../lib/api-profile';

const inputClassName =
  'h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text placeholder:text-muted shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-70';

const labelClassName = 'text-sm font-medium text-muted';

function UsernameHint({ error, checking }: { error: string | null; checking: boolean }) {
  return (
    <p
      className={clsx('text-xs', error ? 'text-danger' : 'text-muted')}
      aria-live="polite"
      aria-atomic="true"
    >
      {error
        ? error
        : checking
        ? 'Memeriksa ketersediaan username...'
        : 'Gunakan huruf, angka, atau underscore (3-30 karakter).'}
    </p>
  );
}

type AccountCardProps = {
  profile: UserProfileRecord;
  email: string;
  avatarUrl: string | null;
  saving: boolean;
  uploading: boolean;
  disabled: boolean;
  onSubmit: (payload: { full_name: string | null; username: string | null }) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onCheckUsername?: (username: string) => Promise<string | null>;
};

export default function AccountCard({
  profile,
  email,
  avatarUrl,
  saving,
  uploading,
  disabled,
  onSubmit,
  onUploadAvatar,
  onCheckUsername,
}: AccountCardProps) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    setFullName(profile.full_name ?? '');
    setUsername(profile.username ?? '');
  }, [profile.full_name, profile.username]);

  const preview = useMemo(() => avatarUrl || null, [avatarUrl]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || saving) return;
    const payload = {
      full_name: fullName.trim() ? fullName.trim() : null,
      username: username.trim() ? username.trim() : null,
    };
    await onSubmit(payload);
  };

  const validateUsername = async (value: string) => {
    if (!value) {
      setUsernameError(null);
      return;
    }
    const pattern = /^[a-z0-9_]{3,30}$/;
    if (!pattern.test(value)) {
      setUsernameError('Username hanya boleh huruf, angka, atau underscore (3-30 karakter).');
      return;
    }
    if (value === (profile.username ?? '')) {
      setUsernameError(null);
      return;
    }
    if (!onCheckUsername) {
      setUsernameError(null);
      return;
    }
    setChecking(true);
    try {
      const result = await onCheckUsername(value);
      setUsernameError(result);
    } finally {
      setChecking(false);
    }
  };

  const handleUsernameBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value.trim().toLowerCase();
    setUsername(value);
    void validateUsername(value);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await onUploadAvatar(file);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await onUploadAvatar(file);
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  return (
    <section
      className="rounded-3xl border border-border-subtle bg-surface shadow-sm"
      aria-labelledby="profile-account-heading"
    >
      <div className="p-4 md:p-6">
        <header className="mb-6 flex flex-col gap-1">
          <h2 id="profile-account-heading" className="text-lg font-semibold text-primary">
            Akun
          </h2>
          <p className="text-sm text-muted">Kelola identitas dasar dan foto profil kamu.</p>
        </header>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:row-span-2">
            <label htmlFor="avatar" className={clsx(labelClassName, 'mb-2 block')}>
              Avatar
            </label>
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={clsx(
                'relative flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border-subtle/80 bg-surface-alt/60 p-4 text-center transition-colors',
                dragActive && 'border-primary/60 bg-primary/5',
                disabled && 'opacity-70'
              )}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Avatar saat ini"
                  className="h-24 w-24 rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-alt text-3xl font-semibold text-muted">
                  {profile.full_name?.[0]?.toUpperCase() || profile.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="space-y-1 text-sm text-muted">
                <p>Tarik & lepas atau pilih gambar baru.</p>
                <p className="text-xs">PNG/JPG/WEBP, maksimal 2MB.</p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface px-4 text-sm font-semibold text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || disabled}
              >
                {uploading ? 'Mengunggah...' : 'Pilih gambar'}
              </button>
              <input
                ref={fileRef}
                id="avatar"
                name="avatar"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="sr-only"
                onChange={handleFileChange}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="full_name" className={labelClassName}>
              Nama lengkap
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              className={inputClassName}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nama kamu"
              disabled={saving || disabled}
              maxLength={80}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="username" className={labelClassName}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className={clsx(inputClassName, usernameError && 'border-danger/60 focus-visible:ring-danger/50')}
              value={username}
              onChange={(event) => {
                const value = event.target.value.toLowerCase();
                setUsername(value);
              }}
              onBlur={handleUsernameBlur}
              placeholder="hematkamu"
              autoComplete="username"
              disabled={saving || disabled}
              aria-invalid={Boolean(usernameError)}
              maxLength={30}
            />
            <UsernameHint error={usernameError} checking={checking} />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="email" className={labelClassName}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={inputClassName}
              value={email}
              readOnly
              disabled
            />
            <p className="text-xs text-muted">Email terhubung melalui Supabase Auth dan tidak dapat diubah dari sini.</p>
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-primary/60 bg-primary/90 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || disabled || Boolean(usernameError)}
            >
              {saving ? 'Menyimpan...' : 'Simpan perubahan'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
