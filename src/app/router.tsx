import type { RouteObject } from 'react-router-dom'
import { productionNavigation } from '../config/navigation'
import { PublicLayout } from '../layouts/PublicLayout'
import { AppShell } from '../layouts/AppShell'
import { RequireRole } from '../features/auth/RequireRole'
import { roles, rolePaths } from '../config/app'
import RouteError from './RouteError'

import { RouteRoot, Landing, Auth, Status, Callback, Reset, SelectRole } from './RouteRoot'

const studentPage = async () => ({ Component: (await import('../features/students/StudentWorkspace')).default })
const organizationPage = async () => ({ Component: (await import('../features/organizations/OrganizationWorkspace')).default })
const projectsPage = async () => ({ Component: (await import('../features/projects/ProjectsWorkspace')).default })
const adminPage = async () => ({ Component: (await import('../features/admin/AdminWorkspace')).default })
function moduleRoutes(role: typeof roles[number]): RouteObject[] {
  if (role === 'ADMIN') return [{ index: true, lazy: adminPage }, ...productionNavigation[role].filter(item => item.path).map(item => ({ path: item.path, lazy: item.path === 'projects' ? projectsPage : adminPage })), { path: 'students/:studentId', lazy: adminPage }, { path: 'organizations/:organizationId', lazy: adminPage }, { path: 'projects/:projectId', lazy: projectsPage }]
  const lazy = role === 'STUDENT' ? studentPage : organizationPage
  return [{ index: true, lazy }, ...productionNavigation[role].filter(item => item.path).map(item => ({ path: item.path, lazy: role === 'ORGANIZATION' && item.path === 'projects' ? projectsPage : lazy })), ...(role === 'ORGANIZATION' ? [{ path: 'projects/new', lazy: projectsPage }, { path: 'projects/:projectId', lazy: projectsPage }] : [])]
}
export function createAppRoutes(preview = import.meta.env.DEV): RouteObject[] {
  return [{ element: <RouteRoot />, errorElement: <RouteError />, children: [
    { element: <PublicLayout />, children: [
      { index: true, element: <Landing /> }, { path: 'login', element: <Auth /> },
      { path: 'forgot-password', element: <Auth recovery /> }, { path: 'unauthorized', element: <Status unauthorized /> },
      { path: 'auth/callback', element: <Callback /> }, { path: 'reset-password', element: <Reset /> },
      { path: 'select-role', element: <SelectRole /> }, { path: '*', element: <Status /> },
    ] },
    ...roles.map(role => ({ element: <RequireRole role={role} />, children: [
      { path: 'app/' + rolePaths[role], element: <AppShell role={role} />, children: [
        ...moduleRoutes(role),
      ] },
    ] })),
    ...(preview && import.meta.env.DEV ? [{
      path: 'dev/*', lazy: async () => {
        const module = await import('../features/preview/PreviewRoutes')
        return { Component: module.PreviewRoutes }
      },
    }] : []),
  ] }]
}
