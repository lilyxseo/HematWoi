import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function AuthMenu() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!user) return null;
  return (
    <div className="relative group">
      <button className="w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
        {user.email?.charAt(0).toUpperCase()}
      </button>
      <div className="absolute right-0 mt-2 w-40 bg-surface-1 border border-border rounded shadow-md hidden group-focus-within:block group-hover:block">
        <Link className="block px-4 py-2 hover:bg-surface-2" to="/profile">
          Profile
        </Link>
        <Link className="block px-4 py-2 hover:bg-surface-2" to="/settings">
          Settings
        </Link>
        <button
          onClick={() => supabase.auth.signOut()}
          className="block w-full text-left px-4 py-2 hover:bg-surface-2"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
