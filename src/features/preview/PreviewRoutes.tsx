import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '../../layouts/AppShell'
import { LoadingState } from '../../components/feedback/States'
import { roles, rolePaths } from '../../config/app'
import { navigation } from '../../config/navigation'
const Student = lazy(() => import('../students/StudentPreview'))
const Organization = lazy(() => import('../organizations/OrganizationPreview'))
const Admin = lazy(() => import('../admin/AdminPreview'))
const Feature = lazy(() => import('./FeaturePreview'))
const Status = lazy(() => import('../public/StatusPage'))
export function PreviewRoutes() {
  return <Suspense fallback={<LoadingState />}><Routes>
    {roles.map(role => <Route key={role} path={rolePaths[role]} element={<AppShell role={role} preview />}>
      <Route index element={role === 'STUDENT' ? <Student /> : role === 'ORGANIZATION' ? <Organization /> : <Admin />} />
      {navigation[role].filter(item => item.path).map(item => <Route key={item.path} path={item.path} element={<Feature role={role} />} />)}
    </Route>)}
    <Route path="*" element={<Status />} />
  </Routes></Suspense>
}
