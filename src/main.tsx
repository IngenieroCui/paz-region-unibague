import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import AdminLogin from './users/admin/login.tsx'

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
  },
  {
    path: "/admin/login",
    element: <AdminLogin />,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
