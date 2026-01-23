import { formatMoney } from '../lib/format';

function toRupiah(n = 0) {
  return formatMoney(n, 'IDR');
}

export default function Summary({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="card text-center">
        <div className="text-sm">Pemasukan</div>
        <div className="text-lg font-semibold text-success hw-money">
          {toRupiah(stats?.income || 0)}
        </div>
      </div>
      <div className="card text-center">
        <div className="text-sm">Pengeluaran</div>
        <div className="text-lg font-semibold text-danger hw-money">
          {toRupiah(stats?.expense || 0)}
        </div>
      </div>
      <div className="card text-center">
        <div className="text-sm">Saldo</div>
        <div className="text-lg font-semibold hw-money">
          {toRupiah(stats?.balance || 0)}
        </div>
      </div>
    </div>
  );
}
