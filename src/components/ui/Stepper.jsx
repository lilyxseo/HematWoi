export default function Stepper({ current = 0, steps = [] }) {
  const percent = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`flex-1 text-center text-xs ${
              i <= current ? "text-brand font-semibold" : "text-slate-500"
            }`}
          >
            {s}
          </div>
        ))}
      </div>
      <div
        className="relative h-2 bg-slate-200 rounded-full dark:bg-slate-700"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={steps.length - 1}
      >
        <div
          className="absolute left-0 top-0 h-2 bg-brand rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
