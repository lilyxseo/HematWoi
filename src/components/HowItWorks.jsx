const STEPS = [
  {
    step: "01",
    title: "Upload file",
    description: "Drag & drop or pick a file. No login needed.",
  },
  {
    step: "02",
    title: "Get link",
    description: "We instantly generate a secure share link for you.",
  },
  {
    step: "03",
    title: "Share",
    description: "Send the link to anyone for quick downloads.",
  },
  {
    step: "04",
    title: "Auto deleted",
    description: "Files vanish after the expiry you choose.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            How it works
          </p>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
            Share files in four simple steps
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Designed to be as lightweight as sending a message.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/80"
            >
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                {item.step}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
