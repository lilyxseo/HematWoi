import { ReactNode, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useIsAdmin } from '../hooks/useIsAdmin';

type AdminGuardProps = {
  children: ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const addToast = toast?.addToast;
  const { loading, user, isAdmin, error } = useIsAdmin();
  const unauthorizedToastRef = useRef(false);
  const errorToastRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true, state: { from: location.pathname } });
    }
  }, [loading, location.pathname, navigate, user]);

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      if (!unauthorizedToastRef.current) {
        unauthorizedToastRef.current = true;
        addToast?.('Akses admin diperlukan', 'error');
      }
      navigate('/', { replace: true });
    }
  }, [addToast, isAdmin, loading, navigate, user]);

  useEffect(() => {
    if (!loading && error && !errorToastRef.current) {
      errorToastRef.current = true;
      addToast?.(error, 'error');
    }
  }, [addToast, error, loading]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-500" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
