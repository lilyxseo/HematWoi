import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Navigate, useLocation, Outlet } from 'react-router-dom';

export default function AuthGuard({ children }) {
  const [session, setSession] = useState();
  const location = useLocation();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;
  return children ? children : <Outlet />;
}
