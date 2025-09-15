import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { CloudRepo } from '../repo/CloudRepo';
import { LocalRepo } from '../repo/LocalRepo';
import { IRepo } from '../interfaces/IRepo';

interface Ctx {
  mode: 'cloud' | 'local';
  setMode: (m: 'cloud' | 'local') => void;
  repo: IRepo;
}

const DataContext = createContext<Ctx | undefined>(undefined);

export function DataProvider({ children, initialMode }: { children: ReactNode; initialMode?: 'cloud' | 'local'; }) {
  const [mode, setMode] = useState<'cloud' | 'local'>(() => (localStorage.getItem('hw:mode') as 'cloud' | 'local') || initialMode || 'cloud');

  const repo = useMemo<IRepo>(() => (mode === 'cloud' ? new CloudRepo(supabase) : new LocalRepo()), [mode]);

  useEffect(() => {
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
