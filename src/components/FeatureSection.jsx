const FEATURES = [
  {
    title: "Anonymous upload",
    description: "Send files without creating an account or remembering passwords.",
  },
  {
    title: "Auto-expire storage",
    description: "Files are deleted after your chosen time, default 7 days.",
  },
  {
    title: "Secure by design",
    description: "Private links and encrypted transfer keep your uploads safe.",
  },
  {
    title: "Fast upload",
    description: "Optimized for quick transfers with minimal waiting time.",
  },
  {
    title: "No registration",
    description: "Start sharing immediately. Perfect for quick file drops.",
  },
];

export default function FeatureSection() {
  return (
    <section id="features" className="py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Features
          </p>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Everything you need for instant file sharing
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            SaveWoi keeps your workflow fast and simple, without compromising
            privacy.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg dark:border-slate-800/70 dark:bg-slate-900/80"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/20 dark:text-blue-200">
                <span className="text-sm font-bold">★</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
