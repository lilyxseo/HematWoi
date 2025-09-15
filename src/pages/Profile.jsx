import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  if (!user) return <div className="p-4">Belum login.</div>;
  return (
    <div className="p-4 space-y-2">
      <h1 className="text-xl font-semibold">Profile</h1>
      <div>
        <strong>Name:</strong> {user.user_metadata?.name || '-'}
      </div>
      <div>
        <strong>Email:</strong> {user.email}
      </div>
    </div>
  );
}
