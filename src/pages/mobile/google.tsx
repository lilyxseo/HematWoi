import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true } }
);

export default function MobileGoogleCallback() {
  const [msg, setMsg] = useState('Memproses login…');

  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams(window.location.search);
        const idToken = p.get('id_token');

        if (!idToken) {
          setMsg('Tidak ada id_token.');
          return;
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (error) {
          console.error('[MOBILE GOOGLE] signInWithIdToken error', error);
          setMsg('Gagal login: ' + error.message);
          return;
        }

        setMsg('Berhasil login. Mengalihkan…');
        window.location.replace('/native-google-login');
      } catch (e: any) {
        console.error('[MOBILE GOOGLE] unexpected error', e);
        setMsg('Terjadi error tak terduga.');
      }
    })();
  }, []);

  return <p style={{ textAlign: 'center', marginTop: 64 }}>{msg}</p>;
}
