import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { CloudRepo } from '../repo/CloudRepo';
import { LocalRepo } from '../repo/LocalRepo';
import { IRepo } from '../interfaces/IRepo';

const STORAGE_KEY = 'hw:connectionMode';

type DataMode = 'online' | 'local';

interface Ctx {
  mode: DataMode;
  setMode: (m: DataMode) => void;
  repo: IRepo;
}

const DataContext = createContext<Ctx | undefined>(undefined);

export function DataProvider({ children, initialMode }: { children: ReactNode; initialMode?: DataMode; }) {
  const [mode, setMode] = useState<DataMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('hw:mode');
      if (stored === 'cloud') return 'online';
      if (stored === 'online' || stored === 'local') return stored;
      if (initialMode) return initialMode;
      return 'online';
    } catch {
      return initialMode || 'online';
    }
  });

  const repo = useMemo<IRepo>(() => (mode === 'online' ? new CloudRepo(supabase) : new LocalRepo()), [mode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    localStorage.setItem('hw:mode', mode);
  }, [mode]);

  return <DataContext.Provider value={{ mode, setMode, repo }}>{children}</DataContext.Provider>;
}

export function useRepo(): IRepo {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useRepo must be used within DataProvider');
  return ctx.repo;
}

export function useDataMode() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataMode must be used within DataProvider');
  return { mode: ctx.mode, setMode: ctx.setMode };
}
