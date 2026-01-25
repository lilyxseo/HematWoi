import DarkModeToggle from "./DarkModeToggle";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/70">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white shadow">
            S
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              SaveWoi
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Temporary cloud storage
            </p>
          </div>
        </a>
        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
          <a href="#features" className="transition hover:text-blue-600">
            Features
          </a>
          <a href="#how" className="transition hover:text-blue-600">
            How it works
          </a>
          <a href="#pricing" className="transition hover:text-blue-600">
            Limits
          </a>
          <a href="#contact" className="transition hover:text-blue-600">
            Contact
          </a>
        </div>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
          <a
            href="#upload"
            className="hidden rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500 sm:inline-flex"
          >
            Upload File Now
          </a>
        </div>
      </nav>
    </header>
  );
}
