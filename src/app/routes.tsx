import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import ReceivePage from '../pages/Receive/ReceivePage';
import PutawayPage from '../pages/Putaway/PutawayPage';
import PickPage from '../pages/Pick/PickPage';
import CycleCountPage from '../pages/CycleCount/CycleCountPage';
import InventoryPage from '../pages/Inventory/InventoryPage';
import ItemsPage from '../pages/Masters/ItemsPage';
import LocationsPage from '../pages/Masters/LocationsPage';
import { useAuthStore } from '../lib/utils';

const LoginPage = () => {
  const login = useAuthStore((state) => state.loginAs);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-[var(--color-text)]">WMS Console</h1>
          <p className="text-sm text-slate-500">Select a role to enter the warehouse console.</p>
        </header>
        <div className="grid gap-3">
          {(['operator', 'supervisor', 'admin'] as const).map((role) => (
            <button
              key={role}
              onClick={() => login(role)}
              className="rounded-xl bg-[var(--color-primary)] py-3 text-white transition hover:bg-[var(--color-primary-hover)]"
            >
              Continue as {role}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const ready = useAuthStore((state) => state.ready);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        Loading workspace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'receive', element: <ReceivePage /> },
          { path: 'putaway', element: <PutawayPage /> },
          { path: 'pick', element: <PickPage /> },
          { path: 'cycle-count', element: <CycleCountPage /> },
          { path: 'inventory', element: <InventoryPage /> },
          { path: 'masters/items', element: <ItemsPage /> },
          { path: 'masters/locations', element: <LocationsPage /> }
        ]
      }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
]);

export const AppRoutes = () => {
  return <RouterProvider router={router} />;
};
