import { FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/Modal.jsx';
import type { AdminUserItem, AdminUserProfile } from '../../../lib/api/adminUsers';

type UserFormMode = 'create' | 'edit';

type FormState = {
  email: string;
  password: string;
  profile: AdminUserProfile;
  sendEmailInvite: boolean;
};

type ValidationErrors = Partial<Record<'email' | 'password', string>>;

type SubmitPayload = {
  email: string;
  password?: string;
  profile: Partial<AdminUserProfile>;
  sendEmailInvite?: boolean;
};

type UserFormModalProps = {
  open: boolean;
  mode: UserFormMode;
  user?: AdminUserItem | null;
  submitting?: boolean;
  forcePassword?: boolean;
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void> | void;
};

const DEFAULT_PROFILE: AdminUserProfile = {
  role: 'user',
  is_active: true,
  full_name: '',
  username: '',
  avatar_url: '',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta',
  theme: 'system',
};

function validateEmail(email: string) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email.trim().toLowerCase());
}

function validatePassword(password: string) {
  if (!password || password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

function mergeProfile(user?: AdminUserItem | null): AdminUserProfile {
  if (!user) return { ...DEFAULT_PROFILE };
  return {
    role: user.profile.role,
    is_active: Boolean(user.profile.is_active),
    full_name: user.profile.full_name ?? '',
    username: user.profile.username ?? '',
    avatar_url: user.profile.avatar_url ?? '',
    locale: user.profile.locale ?? 'id-ID',
    timezone: user.profile.timezone ?? 'Asia/Jakarta',
    theme: user.profile.theme ?? 'system',
  };
}

export default function UserFormModal({
  open,
  mode,
  user,
  submitting,
  forcePassword = false,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [form, setForm] = useState<FormState>(() => ({
    email: user?.email ?? '',
    password: '',
    profile: mergeProfile(user),
    sendEmailInvite: false,
  }));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showPassword, setShowPassword] = useState<boolean>(mode === 'create' || forcePassword);

  useEffect(() => {
    if (!open) return;
    setForm({
      email: user?.email ?? '',
      password: '',
      profile: mergeProfile(user),
      sendEmailInvite: false,
    });
    setErrors({});
    setShowPassword(mode === 'create' || forcePassword);
  }, [open, user, mode, forcePassword]);

  const title = mode === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna';
  const submitLabel = mode === 'create' ? 'Buat Pengguna' : 'Simpan Perubahan';

  const passwordRequired = useMemo(() => {
    if (mode === 'create' && !form.sendEmailInvite) return true;
    if (mode === 'edit' && showPassword) return true;
    return false;
  }, [form.sendEmailInvite, mode, showPassword]);

  const handleProfileChange = <K extends keyof AdminUserProfile>(key: K, value: AdminUserProfile[K]) => {
    setForm((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [key]: value,
      },
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ValidationErrors = {};

    if (!validateEmail(form.email)) {
      nextErrors.email = 'Email tidak valid';
    }

    if (passwordRequired && !validatePassword(form.password)) {
      nextErrors.password = 'Password minimal 8 karakter dengan huruf besar, kecil, dan angka';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload: SubmitPayload = {
      email: form.email.trim(),
      profile: {
        role: form.profile.role,
        is_active: Boolean(form.profile.is_active),
        full_name: form.profile.full_name?.trim() || undefined,
        username: form.profile.username?.trim() || undefined,
        avatar_url: form.profile.avatar_url?.trim() || undefined,
        locale: form.profile.locale?.trim() || undefined,
        timezone: form.profile.timezone?.trim() || undefined,
        theme: form.profile.theme ?? 'system',
      },
    };

    if (mode === 'create' && form.sendEmailInvite) {
      payload.sendEmailInvite = true;
    }

    if (passwordRequired && form.password) {
      payload.password = form.password;
    }

    await onSubmit(payload);
  };

  const handleInviteToggle = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      sendEmailInvite: checked,
    }));
    if (checked) {
      setShowPassword(false);
    } else if (mode === 'create') {
      setShowPassword(true);
    }
  };

  const displayName = form.profile.full_name?.trim() || form.profile.username?.trim();
  const hasDisplayName = Boolean(displayName);

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text">Email</span>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
            {errors.email ? <span className="text-xs text-danger">{errors.email}</span> : null}
          </label>

          {mode === 'create' ? (
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={form.sendEmailInvite}
                onChange={(event) => handleInviteToggle(event.target.checked)}
              />
              Kirim undangan email (pengguna akan mengatur password sendiri)
            </label>
          ) : null}

          {passwordRequired ? (
            <label className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm font-medium text-text">
                <span>Password {mode === 'edit' ? 'baru' : ''}</span>
                {mode === 'edit' && !form.sendEmailInvite ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() => setShowPassword(false)}
                  >
                    Batalkan
                  </button>
                ) : null}
              </div>
              <input
                type="password"
                className="input"
                placeholder="Minimal 8 karakter"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required={passwordRequired}
              />
              {errors.password ? <span className="text-xs text-danger">{errors.password}</span> : null}
            </label>
          ) : mode === 'edit' ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm w-fit"
              onClick={() => setShowPassword(true)}
            >
              Setel password baru
            </button>
          ) : null}

          <div className="grid gap-3 rounded-2xl border border-border-subtle bg-surface-2 p-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text">Role & Status</span>
              <p className="text-xs text-muted-foreground">
                Tentukan hak akses dan status aktivasi pengguna.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-text">Role</span>
                <select
                  className="input"
                  value={form.profile.role}
                  onChange={(event) => handleProfileChange('role', event.target.value as AdminUserProfile['role'])}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.profile.is_active}
                  onChange={(event) => handleProfileChange('is_active', event.target.checked)}
                />
                <span>Aktifkan akses</span>
              </label>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border-subtle bg-surface-2 p-4">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text">Profil Publik</span>
              <p className="text-xs text-muted-foreground">
                Informasi ini akan tampil pada tampilan admin dan mungkin terlihat oleh pengguna lain.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-text">Nama Lengkap</span>
                <input
                  type="text"
                  className="input"
                  value={form.profile.full_name ?? ''}
                  onChange={(event) => handleProfileChange('full_name', event.target.value)}
                  placeholder="Misal: Andi Wijaya"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-text">Username</span>
                <input
                  type="text"
                  className="input"
                  value={form.profile.username ?? ''}
                  onChange={(event) => handleProfileChange('username', event.target.value)}
                  placeholder="Misal: andi.w"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-text">Avatar URL</span>
                <input
                  type="url"
                  className="input"
                  value={form.profile.avatar_url ?? ''}
                  onChange={(event) => handleProfileChange('avatar_url', event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-text">Locale</span>
                  <input
                    type="text"
                    className="input"
                    value={form.profile.locale ?? ''}
                    onChange={(event) => handleProfileChange('locale', event.target.value)}
                    placeholder="id-ID"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-text">Timezone</span>
                  <input
                    type="text"
                    className="input"
                    value={form.profile.timezone ?? ''}
                    onChange={(event) => handleProfileChange('timezone', event.target.value)}
                    placeholder="Asia/Jakarta"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-text">Tema</span>
                  <select
                    className="input"
                    value={form.profile.theme ?? 'system'}
                    onChange={(event) => handleProfileChange('theme', event.target.value)}
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {mode === 'edit' && user ? (
            <div className="rounded-2xl border border-border-subtle bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Informasi akun</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>ID Pengguna: <span className="font-mono text-xs">{user.id}</span></li>
                <li>Dibuat pada: {new Date(user.created_at).toLocaleString('id-ID')}</li>
                {user.last_sign_in_at ? (
                  <li>Login terakhir: {new Date(user.last_sign_in_at).toLocaleString('id-ID')}</li>
                ) : null}
                {hasDisplayName ? <li>Nama tampilan: {displayName}</li> : null}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Menyimpan…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
