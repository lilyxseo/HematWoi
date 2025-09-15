import { useState } from 'react';

interface Badge {
  id: string;
  name: string;
  icon?: string;
  description: string;
}

export default function ProfileBadgesCard({ badges = [] }: { badges: Badge[] }) {
  const [filter, setFilter] = useState<'all' | 'recent'>('all');
  const shown = filter === 'recent' ? badges.slice(0, 3) : badges;

  return (
    <section className="p-4 border rounded">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold">Badges</h2>
        <div className="space-x-2 text-sm">
          <button
            className={filter === 'all' ? 'font-bold' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'recent' ? 'font-bold' : ''}
            onClick={() => setFilter('recent')}
          >
            Recent
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500">No badges yet</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {shown.map((b) => (
            <div key={b.id} className="text-center" title={b.description}>
              {b.icon ? (
                <img src={b.icon} alt={b.name} className="w-12 h-12 mx-auto" />
              ) : (
                <div className="w-12 h-12 mx-auto bg-gray-200 rounded" />
              )}
              <p className="text-xs mt-1">{b.name}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
