import { useEffect, useState } from 'react';

import { DEFAULT_NATIVE_TRIGGER_URL } from '../components/GoogleLoginButton';
import { supabase } from '../lib/supabase';

const httpPattern = /^https?:\/\//i;

const MobileGoogleCallback = () => {
  const [status, setStatus] = useState('Memproses login...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idToken = params.get('id_token');

    if (!idToken) {
      setStatus('Tidak ada id_token.');
      return;
    }

    const signIn = async () => {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        console.error(error);
        setStatus(`Gagal login: ${error.message}`);
        return;
      }

      setStatus('Berhasil login. Mengalihkan...');

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
    };

    void signIn();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 text-center">
      <p>{status}</p>
    </div>
  );
};

export default MobileGoogleCallback;
