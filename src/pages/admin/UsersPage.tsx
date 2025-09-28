import UserManagementPanel from '../../components/admin/users/UserManagementPanel';

export default function UsersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95 text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Admin / Users</p>
            <h1 className="text-2xl font-semibold tracking-tight">Kelola Pengguna</h1>
          </div>
          <p className="text-sm text-muted-foreground md:max-w-md">
            Semua operasi user dijalankan lewat Edge Function dengan Service Role Supabase. Pastikan hanya admin aktif yang
            mengakses halaman ini.
          </p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <UserManagementPanel className="pb-20" />
      </main>
    </div>
  );
}
