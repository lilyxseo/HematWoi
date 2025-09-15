import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { NAV_ITEMS, NavItem } from './nav.config';
import AuthGuard from '../guards/AuthGuard';
import { isFeatureEnabled } from '../featureFlags';

function loadComponent(path: string) {
  switch (path) {
    case '/':
      return lazy(() => import('../pages/Home/Home'));
    case '/reports':
      return lazy(() => import('../pages/Reports/Reports'));
    case '/auth':
      return lazy(() => import('../pages/Auth/Auth'));
    default:
      return lazy(() => import('../pages/Home/Home'));
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

export const ROUTES: RouteObject[] = buildRoutes(NAV_ITEMS);
