import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CloudRepo, LocalRepo } from '../lib/repo';

const DataContext = createContext();

export function DataProvider({ children, initialMode = 'cloud' }) {
  const [mode, setMode] = useState(() => localStorage.getItem('hw:mode') || initialMode);
  const repo = useMemo(() => (mode === 'cloud' ? new CloudRepo(supabase) : new LocalRepo()), [mode]);
  useEffect(() => {
    localStorage.setItem('hw:mode', mode);
  }, [mode]);
  return (
    <DataContext.Provider value={{ mode, setMode, repo }}>
      {children}
    </DataContext.Provider>
  );
}

export function useRepo() {
  return useContext(DataContext).repo;
}

export function useDataMode() {
  const { mode, setMode } = useContext(DataContext);
  return { mode, setMode };
}
