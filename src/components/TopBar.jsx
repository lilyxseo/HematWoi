import Logo from './Logo';

function toRupiah(n = 0) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

export default function TopBar({ stats, useCloud, setUseCloud }) {
  return (
    <div className="max-w-5xl mx-auto p-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Logo />
        <h1 className="font-bold text-lg">HematWoi</h1>
        <span className="badge">{useCloud ? 'Cloud' : 'Lokal'}</span>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={useCloud}
            onChange={(e) => setUseCloud(e.target.checked)}
          />
          Cloud
        </label>
        <div className="font-semibold">Saldo: {toRupiah(stats?.balance || 0)}</div>
      </div>
    </div>
  );
}
