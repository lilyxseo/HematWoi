import { createContext, useContext, useEffect, useState } from "react";
import * as apiOnline from "../lib/api.online";
import * as apiLocal from "../lib/api.local";

const STORAGE_KEY = "hw:connectionMode";

const ModeContext = createContext(null);

export function ModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEY) || localStorage.getItem("hw:mode");
      if (stored === "cloud") return "online";
      return stored || "online";
    } catch {
      return "online";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
      localStorage.setItem("hw:mode", mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

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
