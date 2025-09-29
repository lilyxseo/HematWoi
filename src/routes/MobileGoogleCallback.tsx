import { useEffect, useState } from 'react';

import { supabase } from '../lib/supabase';

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
      window.location.replace('/native-google-login');
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
