// Test-only entry/router, never imported by the application or production bundle.
import { createRoot } from 'react-dom/client'
import { createElement as h } from 'react'
import { createMemoryRouter,Outlet,RouterProvider } from 'react-router-dom'
import { AuthContext } from '../../src/features/auth/auth-context.ts'
import { UnsavedChanges } from '../../src/components/forms/UnsavedChanges.tsx'
import { OrganizationCallsPage,AdminCallsPage } from '../../src/features/calls/index.ts'
import { GroupsPage } from '../../src/features/groups/index.ts'
import ProjectsWorkspace from '../../src/features/projects/ProjectsWorkspace.tsx'
import { getSupabase } from '../../src/lib/supabase/client.ts'
import '../../src/styles/tokens.css'
import '../../src/styles/global.css'
import '../../src/styles/components.css'
import '../../src/styles/modules.css'
import '../../src/styles/workspace.css'
if (import.meta.env.DEV && location.hostname === '127.0.0.1') {
  const db = await getSupabase()
  const result = await db?.auth.signInWithPassword({ email:'p6b@example.test',password:'isolated-http-fixture' })
  const params = new URLSearchParams(location.search)
  const role = params.get('role') === 'ADMIN' ? 'ADMIN' : 'ORGANIZATION'
  const router = createMemoryRouter([{ element:h('main',{id:'main',className:'workspace'},h(UnsavedChanges,null,h(Outlet))),children:[
    { path:'/app/organization/calls',element:h(OrganizationCallsPage) },{ path:'/app/organization/calls/:callId',element:h(OrganizationCallsPage) },
    { path:'/app/admin/calls',element:h(AdminCallsPage) },{ path:'/app/admin/calls/:callId',element:h(AdminCallsPage) },
    { path:'/app/organization/projects/:projectId/groups',element:h(GroupsPage) },
    { path:'/app/organization/projects/:projectId',element:h(ProjectsWorkspace) },
  ] }],{ initialEntries:[params.get('route') ?? '/app/organization/calls'] })
  const element = document.getElementById('root')
  if (element) createRoot(element).render(h(AuthContext.Provider,{value:{status:'authenticated',session:result?.data.session ?? null,roles:[role]}},h(RouterProvider,{router})))
}
