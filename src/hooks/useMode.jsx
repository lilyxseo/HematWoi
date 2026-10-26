import { createContext, useContext, useEffect, useState } from "react";
import * as apiOnline from "../lib/api.online";
import * as apiLocal from "../lib/api.local";

import { isSupabaseConfigured } from "../lib/supabase";

const STORAGE_KEY = "hw:connectionMode";

const ModeContext = createContext(null);

export function ModeProvider({ children }) {
  const [mode, setStoredMode] = useState(() => {
    if (!isSupabaseConfigured) return "local";
    try {
      const stored =
        localStorage.getItem(STORAGE_KEY) || localStorage.getItem("hw:mode");
      if (stored === "cloud") return "online";
      return stored === "local" ? "local" : "online";
    } catch {
      return "online";
    }
  });

  useEffect(() => {
    try {
      // Keep an existing cloud preference when configuration is temporarily absent.
      if (isSupabaseConfigured) {
        localStorage.setItem(STORAGE_KEY, mode);
        localStorage.setItem("hw:mode", mode);
      }
    } catch {
      /* ignore */
    }
  }, [mode]);

  const setMode = (next) => setStoredMode((previous) => {
    if (!isSupabaseConfigured) return "local";
    const value = typeof next === "function" ? next(previous) : next;
    return value === "local" ? "local" : "online";
  });
  const toggle = () => setMode((m) => (m === "online" ? "local" : "online"));

  const api = mode === "online" ? apiOnline : apiLocal;

  return (
    <ModeContext.Provider value={{ mode, setMode, toggle, api }}>
      {children}
    </ModeContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
