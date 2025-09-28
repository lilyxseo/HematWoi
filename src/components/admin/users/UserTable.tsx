import type { AdminUserItem, AdminUsersPagination } from '../../../lib/api/adminUsers';
import { useMemo } from 'react';
import { Mail, Chrome, ShieldCheck } from 'lucide-react';

type UserTableProps = {
  users: AdminUserItem[];
  loading?: boolean;
  pagination?: AdminUsersPagination;
  onEdit: (user: AdminUserItem) => void;
  onDelete: (user: AdminUserItem) => void;
  onRequestPasswordReset: (user: AdminUserItem) => void;
  onToggleActive: (user: AdminUserItem, next: boolean) => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  canNext?: boolean;
  canPrev?: boolean;
  togglingUserId?: string | null;
};

type ProviderIconProps = {
  provider: string;
};

function ProviderIcon({ provider }: ProviderIconProps) {
  const normalized = provider.toLowerCase();
  if (normalized === 'email') {
    return <Mail className="h-4 w-4" title="Email" />;
  }
  if (normalized === 'google') {
    return <Chrome className="h-4 w-4" title="Google" />;
  }
  return <ShieldCheck className="h-4 w-4" title={provider} />;
}

function formatRelativeTime(value: string | null) {
  if (!value) return 'Belum pernah';
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return 'Tidak diketahui';
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];
  const formatter = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
  for (const [unit, divisor] of units) {
    if (absDiff >= divisor || unit === 'minute') {
      const value = Math.round(diff / divisor);
      return formatter.format(value, unit);
    }
  }
  return formatter.format(0, 'minute');
}

function getDisplayName(user: AdminUserItem) {
  return user.profile.full_name?.trim() || user.profile.username?.trim() || user.email.split('@')[0];
}

function getAvatarFallback(user: AdminUserItem) {
  const name = getDisplayName(user);
  return name?.slice(0, 1).toUpperCase() ?? user.email.slice(0, 1).toUpperCase();
}

export default function UserTable({
  users,
  loading = false,
  pagination,
  onEdit,
  onDelete,
  onRequestPasswordReset,
  onToggleActive,
  onNextPage,
  onPrevPage,
  canNext,
  canPrev,
  togglingUserId,
}: UserTableProps) {
  const skeletonRows = useMemo(() => Array.from({ length: 5 }), []);

  return (
    <div className="overflow-hidden rounded-3xl border border-border-subtle bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border-subtle">
          <thead className="bg-surface-2/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-5 py-3 text-left">Pengguna</th>
              <th scope="col" className="px-5 py-3 text-left">Email</th>
              <th scope="col" className="px-5 py-3 text-left">Role</th>
              <th scope="col" className="px-5 py-3 text-left">Status</th>
              <th scope="col" className="px-5 py-3 text-left">Login Terakhir</th>
              <th scope="col" className="px-5 py-3 text-left">Dibuat</th>
              <th scope="col" className="px-5 py-3 text-left">Provider</th>
              <th scope="col" className="px-5 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-sm text-text">
            {loading
              ? skeletonRows.map((_, index) => (
                  <tr key={`skeleton-${index}`} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-border" />
                        <div className="h-3 w-24 rounded-full bg-border" />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-3 w-32 rounded-full bg-border" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-3 w-16 rounded-full bg-border" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-3 w-16 rounded-full bg-border" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-3 w-20 rounded-full bg-border" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-3 w-20 rounded-full bg-border" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <div className="h-4 w-4 rounded-full bg-border" />
                        <div className="h-4 w-4 rounded-full bg-border" />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="h-3 w-24 rounded-full bg-border" />
                    </td>
                  </tr>
                ))
              : null}

            {!loading && users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Tidak ada pengguna yang cocok dengan filter saat ini.
                </td>
              </tr>
            ) : null}

            {!loading
              ? users.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-2/60">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {user.profile.avatar_url ? (
                          <img
                            src={user.profile.avatar_url}
                            alt={getDisplayName(user)}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40 text-sm font-semibold">
                            {getAvatarFallback(user)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-semibold text-text">{getDisplayName(user)}</span>
                          <span className="text-xs text-muted-foreground">ID: {user.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-text">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${user.profile.role === 'admin' ? 'bg-brand/15 text-brand' : 'bg-muted/30 text-muted-foreground'}`}
                      >
                        {user.profile.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-text">
                        <input
                          type="checkbox"
                          checked={user.profile.is_active}
                          onChange={(event) => onToggleActive(user, event.target.checked)}
                          disabled={togglingUserId === user.id}
                        />
                        <span>{user.profile.is_active ? 'Aktif' : 'Tidak aktif'}</span>
                      </label>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-muted-foreground" title={user.last_sign_in_at ?? 'Belum pernah login'}>
                        {formatRelativeTime(user.last_sign_in_at)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-muted-foreground" title={new Date(user.created_at).toLocaleString('id-ID')}>
                        {new Date(user.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {(user.identities ?? []).map((identity, index) => (
                          <ProviderIcon key={`${identity.provider}-${index}`} provider={identity.provider} />
                        ))}
                        {user.identities?.length === 0 ? <Mail className="h-4 w-4" title="Email" /> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => onRequestPasswordReset(user)}
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => onDelete(user)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border-subtle bg-surface-1 px-5 py-3 text-xs text-muted-foreground">
        <div>
          Halaman {pagination?.page ?? 1}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onPrevPage}
            disabled={!canPrev}
          >
            Sebelumnya
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onNextPage}
            disabled={!canNext}
          >
            Selanjutnya
          </button>
        </div>
      </div>
    </div>
  );
}
