export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pt-16">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -left-32 top-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />
      </div>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
            Anonymous & instant sharing
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Upload and share files instantly. No account required.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            SaveWoi helps you send files fast with temporary storage, auto-expire
            controls, and simple share links — perfect for quick collaboration.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#upload"
              className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-500"
            >
              Upload File Now
            </a>
            <a
              href="#how"
              className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 dark:border-slate-700 dark:text-slate-200"
            >
              See how it works
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              50MB free uploads
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Auto-delete in 7 days
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Encrypted transfer
            </div>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/20 via-transparent to-blue-300/20" />
          <div className="relative rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Upload mockup
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Drag & drop your file
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
                  84%
                </span>
              </div>
              <div className="rounded-2xl border border-dashed border-blue-300/70 bg-blue-50/60 p-6 text-center text-sm text-blue-600 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
                <p>resume.pdf</p>
                <p className="text-xs text-blue-500/80">2.4 MB • Uploading</p>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-2 w-4/5 rounded-full bg-blue-500" />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Secure transfer</span>
                <span>Share link ready soon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
