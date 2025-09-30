import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

import { DEFAULT_NATIVE_TRIGGER_URL } from '../../../src/components/GoogleLoginButton';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true } }
);

const httpPattern = /^https?:\/\//i;

export default function MobileGoogleCallback() {
  const [msg, setMsg] = useState('Memproses login…');

  useEffect(() => {
    (async () => {
      const p = new URLSearchParams(window.location.search);
      const idToken = p.get('id_token');
      if (!idToken) {
        setMsg('Tidak ada id_token.');
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) {
        setMsg('Gagal login: ' + error.message);
        return;
      }

      // TEMP DEBUG — hapus setelah beres
useEffect(() => {
  const p = new URLSearchParams(window.location.search);
  const idToken = p.get('id_token');
  if (!idToken) return;

  // decode payload JWT (bagian tengah)
  const [, payload] = idToken.split('.');
  const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

  console.log('[ID_TOKEN payload]', json);
  alert(
    [
      `aud: ${json.aud}`,     // harus = Web Client ID kamu
      `azp: ${json.azp ?? '-'}`,
      `email: ${json.email ?? '-'}`,
      `iss: ${json.iss}`,     // accounts.google.com / https://accounts.google.com
      `exp: ${new Date(json.exp * 1000).toISOString()}`
    ].join('\n')
  );
}, []);


      setMsg('Berhasil login. Mengalihkan…');

      const target = DEFAULT_NATIVE_TRIGGER_URL;
      try {
        window.location.replace(target);
      } catch {
        window.location.href = target;
      }

      if (!httpPattern.test(target)) {
        window.setTimeout(() => {
          window.location.replace('/native-google-login');
        }, 1200);
      }
    })();
  }, []);

  return <p style={{ textAlign: 'center', marginTop: 64 }}>{msg}</p>;
}
