import { Fragment, useMemo } from 'react';
import clsx from 'clsx';
import type { AdminUserItem } from '../../../lib/api/adminUsers.ts';

export type UserTablePagination = {
  limit: number;
  offset: number;
  total: number;
  nextCursor: string | null;
  previousCursor: string | null;
};

type UserTableProps = {
  items: AdminUserItem[];
  loading: boolean;
  error: string | null;
  pagination: UserTablePagination | null;
  currentAdminId?: string | null;
  togglingId?: string | null;
  deletingId?: string | null;
  disableToggleIds?: Set<string>;
  onRetry: () => void;
  onToggleActive: (user: AdminUserItem, nextState: boolean) => void;
  onEdit: (user: AdminUserItem) => void;
  onResetPassword: (user: AdminUserItem) => void;
  onDelete: (user: AdminUserItem) => void;
  onNavigate: (offset: number) => void;
};

const relativeFormatter = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
const longDateFormatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

function getRelativeTime(value: string | null): string {
  if (!value) return 'Belum pernah';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tidak diketahui';
  const now = Date.now();
  const diff = date.getTime() - now;
  const seconds = Math.round(diff / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (Math.abs(seconds) < 60) return relativeFormatter.format(seconds, 'second');
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute');
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour');
  if (Math.abs(days) < 30) return relativeFormatter.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return relativeFormatter.format(months, 'month');
  const years = Math.round(months / 12);
  return relativeFormatter.format(years, 'year');
}

function ProviderBadge({ provider }: { provider: string }) {
  const label = provider === 'email' ? 'Email' : provider === 'google' ? 'Google' : provider;
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

function StatusToggle({
  active,
  disabled,
  onChange,
}: {
  active: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onChange(!active);
      }}
      className={clsx(
        'flex h-9 w-20 items-center justify-between rounded-full border px-1 text-[11px] font-semibold transition',
        active ? 'border-primary/70 bg-primary/10 text-primary' : 'border-border/60 bg-muted/30 text-muted-foreground',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary'
      )}
      aria-pressed={active}
      aria-label="Toggle status aktif"
      disabled={disabled}
    >
      <span className={clsx('rounded-full px-2 py-0.5', active ? 'bg-primary text-white' : '')}>Aktif</span>
      <span className={clsx('rounded-full px-2 py-0.5', !active ? 'bg-destructive/10 text-destructive' : '')}>Off</span>
    </button>
  );
}

function Avatar({ user }: { user: AdminUserItem }) {
  const name = user.profile.full_name || user.profile.username || user.email || user.id;
  const initial = name ? name.trim().charAt(0).toUpperCase() : 'U';
  const avatarUrl = user.profile.avatar_url;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-10 w-10 rounded-2xl border border-border/60 object-cover"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
      {initial}
    </div>
  );
}

export default function UserTable({
  items,
  loading,
  error,
  pagination,
  currentAdminId,
  togglingId,
  deletingId,
  disableToggleIds,
  onRetry,
  onToggleActive,
  onEdit,
  onResetPassword,
  onDelete,
  onNavigate,
}: UserTableProps) {
  const disableSet = disableToggleIds ?? new Set<string>();

  const content = useMemo(() => {
    if (error) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 h-10 rounded-2xl border border-destructive/40 px-3 text-xs font-semibold text-destructive transition hover:border-destructive hover:bg-destructive/10"
          >
            Coba lagi
          </button>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="grid gap-3 rounded-2xl border border-border/40 bg-muted/10 p-4 md:grid-cols-[2fr_repeat(5,_1fr)]">
              {Array.from({ length: 6 }).map((__item, col) => (
                <div key={col} className="h-9 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ))}
        </div>
      );
    }

    if (!items.length) {
      return (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center text-sm text-muted-foreground">
          Belum ada pengguna yang sesuai dengan filter.
        </div>
      );
    }

    return (
      <Fragment>
        <div className="hidden overflow-hidden rounded-2xl border border-border/60 md:block">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Pengguna</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Peran</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Last Sign-in</th>
                <th className="px-4 py-3 text-left font-semibold">Dibuat</th>
                <th className="px-4 py-3 text-left font-semibold">Provider</th>
                <th className="px-4 py-3 text-left font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {items.map((user) => {
                const active = user.profile.is_active;
                const disabled = disableSet.has(user.id) || togglingId === user.id || deletingId === user.id;
                return (
                  <tr key={user.id} className="bg-background">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={user} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{user.profile.full_name || user.profile.username || 'Tanpa nama'}</p>
                          <p className="truncate text-xs text-muted-foreground">ID: {user.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold',
                          user.profile.role === 'admin'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted/40 text-muted-foreground'
                        )}
                      >
                        {user.profile.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusToggle
                        active={active}
                        disabled={disabled}
                        onChange={(next) => onToggleActive(user, next)}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <span title={user.last_sign_in_at ? longDateFormatter.format(new Date(user.last_sign_in_at)) : undefined}>
                        {getRelativeTime(user.last_sign_in_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {longDateFormatter.format(new Date(user.created_at))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.identities.length > 0 ? (
                          user.identities.map((identity, index) => (
                            <ProviderBadge key={`${user.id}-${identity.provider}-${index}`} provider={identity.provider} />
                          ))
                        ) : (
                          <ProviderBadge provider="email" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="h-9 rounded-2xl border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                          onClick={() => onEdit(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="h-9 rounded-2xl border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                          onClick={() => onResetPassword(user)}
                        >
                          Reset Password
                        </button>
                        <button
                          type="button"
                          className="h-9 rounded-2xl border border-destructive/40 px-3 text-xs font-semibold text-destructive transition hover:border-destructive hover:bg-destructive/10"
                          onClick={() => onDelete(user)}
                          disabled={deletingId === user.id || currentAdminId === user.id}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {items.map((user) => {
            const active = user.profile.is_active;
            const disabled = disableSet.has(user.id) || togglingId === user.id || deletingId === user.id;
            return (
              <div key={user.id} className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar user={user} />
                  <div>
                    <p className="text-sm font-semibold">{user.profile.full_name || user.profile.username || 'Tanpa nama'}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Peran: {user.profile.role}</span>
                  <span>•</span>
                  <span>Dibuat {longDateFormatter.format(new Date(user.created_at))}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <StatusToggle active={active} disabled={disabled} onChange={(next) => onToggleActive(user, next)} />
                  <div className="flex flex-wrap gap-1">
                    {user.identities.length > 0 ? (
                      user.identities.map((identity, index) => (
                        <ProviderBadge key={`${user.id}-mobile-${identity.provider}-${index}`} provider={identity.provider} />
                      ))
                    ) : (
                      <ProviderBadge provider="email" />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>
                    Last sign-in:{' '}
                    <span title={user.last_sign_in_at ? longDateFormatter.format(new Date(user.last_sign_in_at)) : undefined}>
                      {getRelativeTime(user.last_sign_in_at)}
                    </span>
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="h-9 flex-1 rounded-2xl border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                    onClick={() => onEdit(user)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="h-9 flex-1 rounded-2xl border border-border px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                    onClick={() => onResetPassword(user)}
                  >
                    Reset Password
                  </button>
                  <button
                    type="button"
                    className="h-9 flex-1 rounded-2xl border border-destructive/40 px-3 text-xs font-semibold text-destructive transition hover:border-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(user)}
                    disabled={deletingId === user.id || currentAdminId === user.id}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Fragment>
    );
  }, [error, loading, items, disableSet, togglingId, deletingId, onRetry, onToggleActive, onEdit, onResetPassword, onDelete, currentAdminId]);

  const pageInfo = useMemo(() => {
    if (!pagination) return '0 dari 0';
    const start = pagination.offset + 1;
    const end = Math.min(pagination.offset + pagination.limit, pagination.total);
    return `${start}-${end} dari ${pagination.total}`;
  }, [pagination]);

  const handlePrev = () => {
    if (!pagination) return;
    const nextOffset = Math.max(pagination.offset - pagination.limit, 0);
    if (nextOffset === pagination.offset) return;
    onNavigate(nextOffset);
  };

  const handleNext = () => {
    if (!pagination) return;
    const nextOffset = pagination.offset + pagination.limit;
    if (nextOffset >= pagination.total) return;
    onNavigate(nextOffset);
  };

  return (
    <div className="space-y-4">
      {content}
      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-xs">
          <span className="font-medium text-muted-foreground">{pageInfo}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-2xl border border-border px-3 font-semibold text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handlePrev}
              disabled={!pagination.previousCursor || pagination.offset === 0 || loading}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className="h-9 rounded-2xl border border-border px-3 font-semibold text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleNext}
              disabled={!pagination.nextCursor || loading}
            >
              Selanjutnya
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
