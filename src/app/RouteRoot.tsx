import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { LoadingState } from '../components/feedback/States'
import { RouteEffects } from './RouteEffects'
export const Landing = lazy(() => import('../features/public/LandingPage'))
export const Auth = lazy(() => import('../features/auth/AuthPage'))
export const AccessSelection = lazy(() => import('../features/auth/AccessSelection'))
export const OrganizationRegistration = lazy(() => import('../features/auth/OrganizationRegistration'))
export const Callback = lazy(() => import('../features/auth/AuthCallback'))
export const Reset = lazy(() => import('../features/auth/ResetPassword'))
export const SelectRole = lazy(() => import('../features/auth/SelectRole'))
export const Status = lazy(() => import('../features/public/StatusPage'))
export function RouteRoot() {
  return <Suspense fallback={<LoadingState />}><RouteEffects /><Outlet /></Suspense>
}
