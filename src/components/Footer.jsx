export default function Footer() {
  return (
    <footer id="contact" className="border-t border-slate-200/70 bg-white/70 py-12 dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              SaveWoi
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Temporary & simple cloud storage for instant sharing.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              © 2025 SaveWoi. All rights reserved.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">About</p>
            <a className="block text-slate-600 transition hover:text-blue-600 dark:text-slate-300" href="#features">
              Features
            </a>
            <a className="block text-slate-600 transition hover:text-blue-600 dark:text-slate-300" href="#how">
              How it works
            </a>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">Legal</p>
            <a className="block text-slate-600 transition hover:text-blue-600 dark:text-slate-300" href="#">
              Privacy
            </a>
            <a className="block text-slate-600 transition hover:text-blue-600 dark:text-slate-300" href="#">
              Terms
            </a>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">Contact</p>
            <p className="text-slate-600 dark:text-slate-300">hello@savewoi.com</p>
            <p className="text-slate-600 dark:text-slate-300">+62 812 3456 7890</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
