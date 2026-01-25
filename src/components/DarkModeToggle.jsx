import { useEffect, useState } from "react";

const STORAGE_KEY = "savewoi-theme";

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

export default function DarkModeToggle({ onToggle }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "dark";
    root.classList.toggle("dark", isDark);
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    window.localStorage.setItem(STORAGE_KEY, theme);
    if (onToggle) onToggle(theme);
  }, [theme, onToggle]);

  return (
    <button
      type="button"
      onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
      aria-label="Toggle dark mode"
    >
      <span className="relative flex h-5 w-10 items-center rounded-full bg-slate-200/80 px-1 transition dark:bg-slate-700">
        <span
          className={`h-4 w-4 rounded-full bg-white shadow transition ${
            theme === "dark" ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
