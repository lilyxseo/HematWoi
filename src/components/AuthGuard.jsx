import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthGuard({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .catch(() => null)
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      if (active) {
        setReady(true);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return null;
  }

  return children ? children : <Outlet />;
}
