import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { createAppRoutes } from './app/router'
import { AppProviders } from './app/providers'
import { InstallPWA } from './components/feedback/InstallPWA'
import { PwaUpdate } from './components/feedback/PwaUpdate'
const router = createBrowserRouter(createAppRoutes())
export default function App() {
  return <AppProviders><RouterProvider router={router} /><InstallPWA /><PwaUpdate /></AppProviders>
}
