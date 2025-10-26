import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { NAV_ITEMS, NavItem } from './nav.config';
import AuthGuard from '../guards/AuthGuard';
import { isFeatureEnabled } from '../featureFlags';

const MobileGoogleCallback = lazy(() => import('../routes/MobileGoogleCallback'));
const NativeGoogleLogin = lazy(() => import('../pages/NativeGoogleLogin'));

function loadComponent(path: string) {
  switch (path) {
    case '/':
      return lazy(() => import('../pages/Dashboard'));
    case '/transactions':
      return lazy(() => import('../pages/Transactions'));
    case '/reports':
      return lazy(() => import('../pages/Reports'));
    case '/transaction/add':
      return lazy(() => import('../pages/TransactionAdd'));
    case '/add':
      return lazy(() => import('../pages/TransactionAdd'));
    case '/accounts':
      return lazy(() => import('../pages/AccountsPage'));
    case '/budgets':
    case '/budget':
      return lazy(() => import('../pages/Budgets'));
    case '/budgets/simulation':
      return lazy(() => import('../pages/BudgetSimulation'));
    case '/goals':
      return lazy(() => import('../pages/Goals'));
    case '/wishlist':
      return lazy(() => import('../pages/WishlistPage'));
    case '/debts':
    case '/debs':
      return lazy(() => import('../pages/Debts'));
    case '/categories':
      return lazy(() => import('../pages/Categories'));
    case '/data':
      return lazy(() => import('../pages/DataPage'));
    case '/subscriptions':
      return lazy(() => import('../pages/Subscriptions'));
    case '/settings':
      return lazy(() => import('../pages/SettingsPage'));
    case '/profile':
      return lazy(() => import('../pages/Profile'));
    case '/auth':
      return lazy(() => import('../pages/AuthLogin'));
    case '/native-google-login':
      return lazy(() => import('../pages/NativeGoogleLogin'));
    default:
      return lazy(() => import('../pages/Dashboard'));
  }
}

function buildRoutes(items: NavItem[]): RouteObject[] {
  return items
    .filter((i) => !i.featureFlag || isFeatureEnabled(i.featureFlag))
    .map((item) => {
      const Component = loadComponent(item.path);
      const element = (
        <Suspense fallback={<div />}> <Component /> </Suspense>
      );
      const wrapped = item.protected ? <AuthGuard>{element}</AuthGuard> : element;
      return {
        path: item.path,
        element: wrapped,
        children: item.children ? buildRoutes(item.children) : undefined,
      };
    });
}

export const ROUTES: RouteObject[] = [
  ...buildRoutes(NAV_ITEMS),
  {
    path: '/auth/mobile/google',
    element: (
      <Suspense fallback={<div />}>
        <MobileGoogleCallback />
      </Suspense>
    ),
  },
  {
    path: '/native-google-login',
    element: (
      <Suspense fallback={<div />}>
        <NativeGoogleLogin />
      </Suspense>
    ),
  },
];
