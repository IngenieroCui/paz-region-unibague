import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import AdminLogin from './users/admin/admin_login.tsx'
import EstudiantesLogin from './users/estudiantes/student_login.tsx'
import EmpresasLogin from './users/empresas/empresa_login.tsx'


const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/admin/login",
    element: <AdminLogin />,
  },
  {
    path: "/estudiantes/login",
    element: <EstudiantesLogin />,
  },
  {
    path: "/empresas/login",
    element: <EmpresasLogin />,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
