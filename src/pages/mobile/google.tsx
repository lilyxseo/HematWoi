import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const REDIRECT_SUCCESS = '/';

export default function MobileGoogleCallback() {
  const [msg, setMsg] = useState('Memproses login…');

  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams(window.location.search);
        const idToken = p.get('id_token');

        if (!idToken) {
          setMsg('Token tidak valid.');
          return;
        }

        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (error) {
          console.error('[MOBILE GOOGLE] error:', error);
          setMsg('Gagal login: ' + error.message);
          return;
        }

        setMsg('Berhasil login. Mengalihkan…');
        window.location.replace(REDIRECT_SUCCESS);
      } catch (e: any) {
        console.error('[MOBILE GOOGLE] unexpected:', e);
        setMsg('Terjadi error tak terduga.');
      }
    })();
  }, []);

  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '60vh',
        fontFamily: 'system-ui',
      }}
    >
      <div>
        <h1>HematWoi</h1>
        <p>{msg}</p>
      </div>
    </main>
  );
}
