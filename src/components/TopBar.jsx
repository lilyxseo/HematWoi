import Logo from "./Logo.jsx";

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" });

export default function TopBar({ stats, useCloud, setUseCloud }) {
  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <h1 className="text-xl font-bold">HematWoi</h1>
          <span className="badge ml-2 bg-slate-100 border-slate-200">
            {useCloud ? "Cloud" : "Local"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs flex items-center gap-1">
            <input
              type="checkbox"
              checked={useCloud}
              onChange={(e) => setUseCloud(e.target.checked)}
            />
            Cloud
          </label>
          <div className="text-right">
            <div className="text-xs text-slate-500">Saldo</div>
            <div className="text-lg font-semibold">{idr.format(stats.balance)}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
