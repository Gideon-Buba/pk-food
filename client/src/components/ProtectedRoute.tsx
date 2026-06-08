import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { getToken } from '../api/client';
import type { JwtPayload, Role } from '../types';

interface Props {
  children: React.ReactNode;
  roles?: Role[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const token = getToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const payload = jwtDecode<JwtPayload>(token);
    if (payload.exp * 1000 < Date.now()) {
      return <Navigate to="/login" replace />;
    }
    if (roles && !roles.includes(payload.role)) {
      return <Navigate to="/menu" replace />;
    }
  } catch {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
