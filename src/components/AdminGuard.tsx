import { ReactNode, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useIsAdmin from '../hooks/useIsAdmin';
import { useToast } from '../context/ToastContext.jsx';

type AdminGuardProps = {
  children: ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const { addToast } = useToast();
  const { user, loading, isAdmin, error } = useIsAdmin();
  const location = useLocation();
  const toastShownRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (error && !toastShownRef.current) {
      addToast('Gagal memeriksa hak akses admin', 'error');
      toastShownRef.current = true;
      return;
    }
    if (user && !isAdmin && !toastShownRef.current) {
      addToast('Akses admin diperlukan', 'error');
      toastShownRef.current = true;
    }
  }, [addToast, loading, user, isAdmin, error]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Memeriksa akses admin…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (error) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
