import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/', { replace: true });
      }
    });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      navigate('/', { replace: true });
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Password tidak cocok');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) setError(error.message);
    else setTab('login');
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex gap-2">
        <button
          className={clsx('btn flex-1', tab === 'login' ? 'btn-primary' : 'btn-secondary')}
          onClick={() => setTab('login')}
        >
          Login
        </button>
        <button
          className={clsx('btn flex-1', tab === 'register' ? 'btn-primary' : 'btn-secondary')}
          onClick={() => setTab('register')}
        >
          Register
        </button>
      </div>
      {tab === 'login' && (
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <button disabled={loading} className="btn btn-primary w-full">
            {loading ? '...' : 'Login'}
          </button>
        </form>
      )}
      {tab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-3">
          <input
            className="input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <input
            type="password"
            className="input"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
          <button disabled={loading} className="btn btn-primary w-full">
            {loading ? '...' : 'Register'}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
