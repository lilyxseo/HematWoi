import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Outlet } from 'react-router-dom';

export default function AuthGuard({ children }) {
  const [session, setSession] = useState();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  // Tetap izinkan akses meski belum login agar mode tamu bisa menggunakan aplikasi
  if (!session) return children ? children : <Outlet />;
  return children ? children : <Outlet />;
}
