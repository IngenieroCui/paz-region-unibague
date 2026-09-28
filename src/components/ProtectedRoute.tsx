
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const storedUser = localStorage.getItem('usocoello_user');
  
  if (!storedUser) {
    // Si no hay sesión, mandamos al login
    return <Navigate to="/login" replace />;
  }

  // Si hay sesión, renderizamos las rutas hijas
  return <Outlet />;
}
