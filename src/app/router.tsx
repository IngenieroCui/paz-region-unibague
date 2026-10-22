import type { RouteObject } from 'react-router-dom'
import { productionNavigation } from '../config/navigation'
import { PublicLayout } from '../layouts/PublicLayout'
import { AppShell } from '../layouts/AppShell'
import { RequireRole } from '../features/auth/RequireRole'
import { roles, rolePaths } from '../config/app'
import RouteError from './RouteError'

import { RouteRoot, Landing, Auth, AccessSelection, OrganizationRegistration, Status, Callback, Reset, SelectRole } from './RouteRoot'

const studentPage = async () => ({ Component: (await import('../features/students/StudentWorkspace')).default })
const studentAssignmentPage = async () => ({ Component: (await import('../features/assignments/StudentAssignment')).StudentAssignmentPage })
const organizationPage = async () => ({ Component: (await import('../features/organizations/OrganizationWorkspace')).default })
const projectsPage = async () => ({ Component: (await import('../features/projects/ProjectsWorkspace')).default })
const adminPage = async () => ({ Component: (await import('../features/admin/AdminWorkspace')).default })
const matchingPage = async () => ({ Component: (await import('../features/matching/MatchingWorkspace')).MatchingWorkspace })
const advisorsAdminPage = async () => ({ Component: (await import('../features/advisors/AdvisorsAdminWorkspace')).AdvisorsAdminWorkspace })
const advisorPage = async () => ({ Component: (await import('../features/advisors/AdvisorWorkspace')).AdvisorWorkspace })
const assignmentsPage = async () => ({ Component: (await import('../features/assignments/AssignmentsWorkspace')).AssignmentsWorkspace })
const callsAdminPage = async () => ({ Component: (await import('../features/calls')).AdminCallsPage })
const callsOrganizationPage = async () => ({ Component: (await import('../features/calls')).OrganizationCallsPage })
const groupsPage = async () => ({ Component: (await import('../features/groups')).GroupsPage })
const operationsPage = async () => ({ Component: (await import('../features/operations/OperationsWorkspace')).OperationsWorkspace })
const notificationsPage = async () => ({ Component: (await import('../features/notifications/NotificationsWorkspace')).NotificationsWorkspace })
function roleModuleRoutes(role: typeof roles[number]): RouteObject[] {
  if (role === 'ADMIN') return [{ index: true, lazy: adminPage }, ...productionNavigation[role].filter(item => item.path).map(item => ({ path: item.path, lazy: ['projects','groups'].includes(item.path) ? projectsPage : item.path === 'operations' ? operationsPage : item.path === 'matching' ? matchingPage : item.path === 'calls' ? callsAdminPage : item.path === 'assignments' ? assignmentsPage : ['advisors', 'special-cases'].includes(item.path) ? advisorsAdminPage : adminPage })), { path: 'students/:studentId', lazy: adminPage }, { path: 'organizations/:organizationId', lazy: adminPage }, { path: 'projects/:projectId', lazy: projectsPage }, { path: 'calls/:callId', lazy: callsAdminPage }, { path: 'projects/:projectId/groups', lazy: groupsPage }]
  if (role === 'ADVISOR') return [{ index: true, lazy: advisorPage }, ...productionNavigation[role].filter(item => item.path).map(item => ({ path: item.path, lazy: advisorPage }))]
  const lazy = role === 'STUDENT' ? studentPage : organizationPage
  return [{ index: true, lazy }, ...productionNavigation[role].filter(item => item.path).map(item => ({ path: item.path, lazy: role === 'ORGANIZATION' ? ['projects','groups'].includes(item.path) ? projectsPage : item.path === 'calls' ? callsOrganizationPage : lazy : item.path === 'assignment' ? studentAssignmentPage : lazy })), ...(role === 'ORGANIZATION' ? [{ path: 'projects/new', lazy: projectsPage }, { path: 'projects/:projectId', lazy: projectsPage }, { path: 'calls/:callId', lazy: callsOrganizationPage }, { path: 'projects/:projectId/groups', lazy: groupsPage }] : [])]
}
function moduleRoutes(role: typeof roles[number]): RouteObject[] {
  return [...roleModuleRoutes(role), { path: 'notifications', lazy: notificationsPage }]
}
export function createAppRoutes(preview = import.meta.env.DEV): RouteObject[] {
  return [{ element: <RouteRoot />, errorElement: <RouteError />, children: [
    { element: <PublicLayout />, children: [
      { index: true, element: <Landing /> }, { path: 'login', element: <AccessSelection /> },
      { path: 'login/institucional', element: <Auth audience="institutional" /> },
      { path: 'login/organizaciones', element: <Auth audience="organization" /> },
      { path: 'registro/organizacion', element: <OrganizationRegistration /> },
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
