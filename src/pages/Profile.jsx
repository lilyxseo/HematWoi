import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import AvatarLevel from '../components/AvatarLevel.jsx';
import EventBus from '../lib/eventBus';

export default function ProfilePage({ transactions = [], challenges = [] }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  if (!user) return <div className="p-4">Belum login.</div>;
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Profile</h1>
      <AvatarLevel transactions={transactions} challenges={challenges} />
      <button
        type="button"
        onClick={() => EventBus.emit('xp:add', { code: 'demo', amount: 10 })}
        className="px-2 py-1 text-xs bg-success text-white rounded"
      >
        +10 XP Demo
      </button>
      <div>
        <strong>Name:</strong> {user.user_metadata?.name || '-'}
      </div>
      <div>
        <strong>Email:</strong> {user.email}
      </div>
    </div>
  );
}
