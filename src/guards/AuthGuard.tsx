import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const hasSession = typeof window !== 'undefined' && !!localStorage.getItem('session');
  if (!hasSession) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}
