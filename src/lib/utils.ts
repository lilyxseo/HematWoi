import { format } from 'date-fns';
import { clsx } from 'clsx';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import type { Location, Role } from './types';

export const cn = (...inputs: Array<string | false | null | undefined>) => clsx(inputs);

export const formatDateTime = (value: string | Date) => {
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm');
  } catch {
    return String(value);
  }
};

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
};

const storage = () =>
  typeof window !== 'undefined'
    ? createJSONStorage(() => window.localStorage)
    : createJSONStorage(() => memoryStorage);

type AuthState = {
  ready: boolean;
  isAuthenticated: boolean;
  role: Role;
  loginAs: (role: Role) => void;
  logout: () => void;
};

export const useAuthStore = create(
  persist<AuthState>(
    (set) => ({
      ready: true,
      isAuthenticated: true,
      role: 'operator',
      loginAs: (role) => set({ isAuthenticated: true, role, ready: true }),
      logout: () => set({ isAuthenticated: false })
    }),
    {
      name: 'wms-auth',
      storage: storage()
    }
  )
);

type UIState = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openSidebar: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  openSidebar: () => set({ sidebarOpen: true })
}));

export const roleLabels: Record<Role, string> = {
  operator: 'Operator',
  supervisor: 'Supervisor',
  admin: 'Admin'
};

export const groupLocationsByZone = (locations: Location[]) => {
  return locations.reduce<Record<string, Location[]>>((acc, location) => {
    const key = location.zone ?? 'General';
    acc[key] = acc[key] || [];
    acc[key].push(location);
    return acc;
  }, {});
};
