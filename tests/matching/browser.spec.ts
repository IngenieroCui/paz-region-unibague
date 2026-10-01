import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { calculatePair } from '../../supabase/functions/_shared/matching/engine.ts'
import type { Configuration, Student, Position } from '../../supabase/functions/_shared/matching/engine.ts'
type Row = Record<string, unknown>
async function mockApi(page: Page, role = 'ADMIN') {
  const period = '56000000-0000-0000-0000-000000000010'; const cid = '56000000-0000-0000-0000-000000000020'
  const now = '2026-10-01T12:00:00Z'
  const config: Configuration = { algorithm_version: 'hybrid-v0.1', minimum_recommended_score: 70, weights: { academic: 0, skills: 0, experience: 0, interests: 0, location: 100, preference: 0, semantic: 0 }, rules: { requiredSkillsAreHardConstraint: true, semanticEnabled: false } }
  const students: Student[] = Array.from({ length: 31 }, (_, i) => ({ id: `student-${String(i).padStart(2, '0')}`, academic_program_id: i === 30 ? 'other-program' : 'program', bio: null, desired_work_description: null, current_municipality_id: 'm', origin_municipality_id: null, preferences: [], experiences: [], interests: [], skills: [] }))
  const position: Position = { id: 'position', title: 'Plaza de prueba', description: null, project: { name: 'Proyecto de prueba', summary: null, description: null, municipality_id: 'm' }, programs: [{ academic_program_id: 'program', is_required: true }], requirements: [], skills: [] }
  const tables: Record<string, Row[]> = {
    PYRUnibague_AcademicPeriods: [{ id: period, name: 'Periodo de prueba', is_current: true, created_at: now }],
    PYRUnibague_MatchingConfigurations: [{ ...config, id: cid, name: 'Configuración de prueba', academic_period_id: period, is_active: true, created_at: now }],
    PYRUnibague_MatchingRuns: [], PYRUnibague_MatchCandidates: [],
    PYRUnibague_Students: students.map(s => ({ id: s.id, user_id: s.id, student_code: s.id })),
    PYRUnibague_UserProfiles: students.map(s => ({ user_id: s.id, display_name: 'Cuenta de prueba ' + s.id })),
    PYRUnibague_ProjectPositions: [{ id: position.id, project_id: 'project', title: position.title }],
    PYRUnibague_Projects: [{ id: 'project', name: position.project.name }],
  }
  const calls: string[] = []
  await page.route('https://pyr-e2e.example.test/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const method = request.method(); calls.push(method + ' ' + url.pathname)
    const user = { id: '56000000-0000-0000-0000-000000000001', email: 'p5-test@example.test', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {} }
    if (url.pathname.endsWith('/token')) return route.fulfill({ json: { user, access_token: 'test.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url') + '.fixture', refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer' } })
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user })
    if (url.pathname.endsWith('/pyr_unibague_current_roles')) return route.fulfill({ json: [role] })
    if (url.pathname.endsWith('/matching-run')) {
      const body = request.postDataJSON() as Row
      expect(Object.keys(body).sort()).toEqual(['academic_period_id', 'matching_configuration_id'])
      const selected = tables.PYRUnibague_MatchingConfigurations!.find(c => c.id === body.matching_configuration_id)!
      const runId = crypto.randomUUID(); const candidates = students.map(s => ({ ...calculatePair(s, position, selected as unknown as Configuration), id: crypto.randomUUID(), matching_run_id: runId, created_at: now }))
      tables.PYRUnibague_MatchCandidates!.push(...candidates)
      const summary = { algorithm_version: 'hybrid-v0.1', configuration_snapshot: { ...selected }, student_count: 31, position_count: 1, pair_count: 31, eligible_pairs: 30, blocked_pairs: 1, recommended_pairs: 30, below_threshold_pairs: 0, semantic_mode: 'structured_only', warnings: ['SEMANTIC_DISABLED'] }
      tables.PYRUnibague_MatchingRuns!.unshift({ id: runId, academic_period_id: body.academic_period_id, matching_configuration_id: selected.id, created_at: now, status: 'completed', summary })
      return route.fulfill({ json: { run_id: runId, summary } })
    }
    const table = url.pathname.split('/').at(-1)!
    const rows = tables[table]
    if (!rows) return route.fulfill({ status: 400, json: { message: 'Unknown test endpoint' } })
    let filtered = rows.filter(row => [...url.searchParams].every(([key, value]) => value.startsWith('eq.') ? String(row[key]) === value.slice(3) : value.startsWith('gte.') ? Number(row[key]) >= Number(value.slice(4)) : value.startsWith('lt.') ? Number(row[key]) < Number(value.slice(3)) : true))
    if (method === 'POST') { const row = { ...request.postDataJSON(), id: crypto.randomUUID(), created_at: now }; rows.push(row); filtered = [row] }
    if (method === 'PATCH') filtered.forEach(row => Object.assign(row, request.postDataJSON()))
    if (url.searchParams.get('order')?.startsWith('total_score')) filtered.sort((a, b) => Number(b.total_score ?? -1) - Number(a.total_score ?? -1) || String(a.id).localeCompare(String(b.id)))
    const count = filtered.length; const offset = Number(url.searchParams.get('offset') ?? 0); const limit = Number(url.searchParams.get('limit') ?? 1000); filtered = filtered.slice(offset, offset + limit)
    const headers = { 'Content-Range': `${offset}-${Math.max(offset, offset + filtered.length - 1)}/${count}`, 'Access-Control-Expose-Headers': 'Content-Range' }
    if (method === 'HEAD') return route.fulfill({ status: 200, headers })
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json')
    return route.fulfill({ headers, json: single ? filtered[0] : filtered })
  })
  return { tables, calls, cid }
}
test('P5 create, run, ranking, blockers, duplicate and responsive accessible detail', async ({ page }) => {
  const api = await mockApi(page); await page.goto('/tests/matching/harness.html')
  await expect(page.getByRole('heading', { name: 'Matching', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ejecutar', exact: true }).click(); await page.getByLabel('Configuración para ejecutar').selectOption(api.cid)
  await page.getByRole('button', { name: 'Revisar y ejecutar' }).click(); const confirm = page.getByRole('dialog', { name: 'Confirmar ejecución de matching' }); await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Ejecutar compatibilidad' }).click(); await expect(page.getByText('31 parejas · página 1')).toBeVisible()
  await expect(page.locator('.matching-ranking > li')).toHaveCount(25)
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click(); await expect(page.locator('.matching-ranking > li')).toHaveCount(6)
  await page.getByLabel('Filtrar compatibilidad').selectOption('blocked'); await expect(page.getByText('1 parejas · página 1')).toBeVisible(); await expect(page.getByText('Sin score final')).toBeVisible()
  await page.getByRole('button', { name: 'Ver detalle', exact: true }).click(); const detail = page.getByRole('dialog', { name: 'Detalle de compatibilidad' }); await expect(detail).toBeVisible(); await expect(detail.getByText('ACADEMIC_PROGRAM_REQUIRED', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape'); await expect(detail).not.toBeVisible()
  await page.getByLabel('Filtrar compatibilidad').selectOption('recommended'); await expect(page.getByText('30 parejas · página 1')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Ver detalle', exact: true }).first().click(); await expect(detail.getByText(/Semántica de la pareja: no disponible/)).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Configuraciones', exact: true }).click(); await page.getByLabel('Configuración a editar').selectOption(api.cid)
  await expect(page.getByLabel('Peso academic (%)')).toBeDisabled(); await page.getByRole('button', { name: 'Duplicar configuración' }).click(); await expect(page.getByLabel('Peso academic (%)')).toBeEnabled()
  await page.getByRole('button', { name: 'Crear copia' }).click(); await expect.poll(() => api.tables.PYRUnibague_MatchingConfigurations!.length).toBe(2)
  expect(api.calls.some(call => call.includes('Assignments'))).toBe(false)
})
test('P5 non-admin permission state fails closed without loading matching tables', async ({ page }) => { const api = await mockApi(page, 'STUDENT'); await page.goto('/tests/matching/harness.html'); await expect(page.getByText('Matching requiere el rol ADMIN.')).toBeVisible(); expect(api.calls.some(call => call.includes('/rest/v1/PYRUnibague_Matching'))).toBe(false) })
