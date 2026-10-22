import type { Page } from '@playwright/test'
export type TestRow = Record<string, unknown>
const uid = '00000000-0000-0000-0000-000000000001'
const sid = '10000000-0000-0000-0000-000000000001'
const oid = '30000000-0000-0000-0000-000000000001'
const mid = '20000000-0000-0000-0000-000000000001'
const now = '2026-10-01T12:00:00Z'
export async function p3Api(page: Page, role: 'STUDENT' | 'ORGANIZATION', options: { onboarding?: boolean; emptyCatalogs?: boolean; readOnly?: boolean } = {}) {
  const tables: Record<string, TestRow[]> = {}
  const names = ['UserProfiles','Students','AcademicPrograms','Municipalities','Skills','AcademicPeriods','StudentPeriodParticipations','StudentExperiences','StudentSkills','StudentInterests','StudentLocationPreferences','StudentDocuments','Organizations','OrganizationMembers','OrganizationTypes','OrganizationDocuments','OrganizationReviews','SystemConfigurations','OrganizationContacts']
  for (const name of names) tables['PYRUnibague_' + name] = []
  const table = (name: string) => tables['PYRUnibague_' + name]!
  table('UserProfiles').push({ user_id: uid, display_name: 'Cuenta de prueba', created_at: now, updated_at: now })
  if (!options.emptyCatalogs) {
    table('AcademicPrograms').push({ id: 'program', name: 'Programa de prueba', active: true })
    table('Municipalities').push({ id: mid, municipality_name: 'Municipio A', department_name: 'Departamento', active: true }, { id: mid.replace(/1$/, '2'), municipality_name: 'Municipio B', department_name: 'Departamento', active: true })
    table('Skills').push({ id: 'skill', name: 'Habilidad de prueba', aliases: [], active: true })
    table('OrganizationTypes').push({ id: 'type', name: 'Tipo de prueba', active: true })
  }
  table('AcademicPeriods').push({ id: 'period', name: 'Periodo de prueba', is_current: true })
  if (!options.onboarding && role === 'STUDENT') {
    table('Students').push({ id: sid, user_id: uid, student_code: 'TEST1', academic_program_id: 'program', current_semester: 6, bio: 'Presentación', desired_work_description: 'Trabajo territorial', origin_municipality_id: mid, current_municipality_id: mid, profile_links: {}, is_active: true, created_at: now, updated_at: now })
    table('StudentPeriodParticipations').push({ id: 'participation', student_id: sid, academic_period_id: 'period', status: 'pending', eligible_for_matching: false })
  }
  if (!options.onboarding && role === 'ORGANIZATION') {
    table('Organizations').push({ id: oid, legal_name: 'Entidad de prueba', display_name: 'Entidad de prueba', organization_type_id: 'type', municipality_id: mid, description: 'Descripción', tax_id: null, website: null, status: 'pending_review', verified_at: null, verified_by: null, created_by: uid, created_at: now, updated_at: now })
    table('OrganizationMembers').push({ id: 'member', organization_id: oid, user_id: uid, can_manage: !options.readOnly, is_primary_contact: true, status: 'active' })
    table('OrganizationReviews').push({ id: 'review', organization_id: oid, decision: 'changes_requested', notes: 'Actualiza la descripción.', created_at: now })
  }
  const calls: { path: string; method: string; body: unknown }[] = []
  let failNextTable = ''
  await page.route('https://pyr-e2e.example.test/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const method = request.method()
    let body: TestRow = {}; try { body = request.postDataJSON() as TestRow ?? {} } catch { /* binary */ }
    calls.push({ path: url.pathname, method, body })
    const user = { id: uid, email: 'test@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
    if (url.pathname.endsWith('/pyr_unibague_current_roles')) return route.fulfill({ json: [role] })
    if (url.pathname.endsWith('/token')) {
      const token = [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: uid, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'test'].join('.')
      return route.fulfill({ json: { access_token: token, refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user } })
    }
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user })
    if (url.pathname.endsWith('/logout')) return route.fulfill({ json: {} })
    if (url.pathname.includes('/rpc/')) {
      const name = url.pathname.split('/').at(-1)
      if (name === 'pyr_unibague_student_assignment') return route.fulfill({ json: null })
      if (name === 'pyr_unibague_register_organization') {
        const fields = Object.fromEntries(Object.entries(body).map(([key, value]) => [key.replace(/^p_/, ''), value]))
        table('Organizations').push({ ...fields, id: oid, status: 'pending_review', verified_at: null, verified_by: null, created_by: uid, created_at: now, updated_at: now })
        table('OrganizationMembers').push({ id: 'member', organization_id: oid, user_id: uid, can_manage: true, is_primary_contact: true, status: 'active' })
        return route.fulfill({ json: oid })
      }
      if (name === 'pyr_unibague_set_student_preferences') {
        tables.PYRUnibague_StudentLocationPreferences = (body.p_municipality_ids as string[]).map((id, index) => ({ id: 'pref-' + id, student_id: sid, municipality_id: id, preference_order: index + 1 }))
        return route.fulfill({ json: null })
      }
      if (name === 'pyr_unibague_order_student_interests') { (body.p_ids as string[]).forEach((id, index) => { const row = table('StudentInterests').find(item => item.id === id); if (row) row.sort_order = index + 1 }); return route.fulfill({ json: null }) }
    }
    if (url.pathname.includes('/storage/v1/object/sign/')) return route.fulfill({ json: { signedURL: '/object/sign/test?token=temporary' } })
    if (url.pathname.includes('/storage/v1/object/')) return route.fulfill({ json: method === 'DELETE' ? [] : { Key: 'test' } })
    const name = url.pathname.split('/').at(-1) ?? ''
    if (name.startsWith('PYRUnibague_') && tables[name]) {
      if (failNextTable === name) { failNextTable = ''; return route.fulfill({ status: 400, json: { message: 'isolated failure', code: 'TEST' } }) }
      const matching = (row: TestRow) => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3))
      let rows = tables[name]!.filter(matching)
      if (method === 'POST') { const row = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...body }; tables[name]!.push(row); rows = [row] }
      if (method === 'PATCH') rows.forEach(row => Object.assign(row, body, { updated_at: now }))
      if (method === 'DELETE') tables[name] = tables[name]!.filter(row => !matching(row))
      const order = url.searchParams.get('order')?.split(',')[0]?.split('.')
      if (order?.[0]) rows.sort((a,b) => String(a[order[0]!] ?? '').localeCompare(String(b[order[0]!] ?? ''), 'es', { numeric: true }) * (order[1] === 'desc' ? -1 : 1))
      const single = request.headers().accept?.includes('application/vnd.pgrst.object+json')
      if (single) return rows.length === 1 ? route.fulfill({ json: rows[0] }) : route.fulfill({ status: 406, json: { code: 'PGRST116', message: '0 rows' } })
      return route.fulfill({ json: rows })
    }
    return route.fulfill({ status: 400, json: { message: 'Unrecognized P3 test endpoint' } })
  })
  return { tables, calls, uid, sid, oid, mid, table, failNext: (name: string) => { failNextTable = 'PYRUnibague_' + name } }
}
export async function p3Login(page: Page) {
  await page.goto('/login/organizaciones'); await page.getByLabel('Correo electrónico').fill('test@example.test'); await page.getByLabel('Contraseña', { exact: true }).fill('password123'); await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
}
