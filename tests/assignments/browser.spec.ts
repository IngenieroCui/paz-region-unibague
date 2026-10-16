import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
function pool(scores: number[][], capacity = 1) {
  return { periodId: 'period', revision: 'draft', run: { id: 'run', periodId: 'period', status: 'completed', threshold: 70, configurationId: 'config', snapshot: {} },
    students: scores.map((_, i) => ({ id: `s${i}`, label: `Estudiante ${i}`, active: true, eligible: true, periodId: 'period' })),
    positions: [0, 1].map(i => ({ id: `p${i}`, label: `Plaza ${i}`, projectId: `project${i}`, projectName: `Proyecto ${i}`, organizationId: 'org', organizationName: 'Organización', active: true, approved: true, validated: true, capacity, periodId: 'period' })),
    candidates: scores.flatMap((row, s) => row.map((score, p) => ({ id: `c${s}-${p}`, runId: 'run', studentId: `s${s}`, positionId: `p${p}`, score, eligible: true, currentEligible: true, blockers: [] }))),
    existing: [] as { id: string; studentId: string; positionId: string; periodId: string; active: boolean }[] }
}

async function api(page: Page, role = 'ADMIN', large = false) {
  const data = pool(large ? Array.from({ length: 31 }, () => [95, 92]) : [[95, 92], [94, 72]], large ? 20 : 1)
  const calls: string[] = []; const writes: Record<string, unknown>[][] = []; const history: Record<string, unknown>[] = []; const events: Record<string, unknown>[] = []
  let revision = 1; const state = { staleNext: false }
  await page.route('https://pyr-e2e.example.test/**', async route => {
    const request = route.request(); const url = new URL(request.url()); calls.push(url.pathname)
    const user = { id: '66000000-0000-0000-0000-000000000001', email: 'p6c-test@example.test', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {} }
    if (url.pathname.endsWith('/token')) return route.fulfill({ json: { user, access_token: 'test.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture', refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer' } })
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user })
    if (url.pathname.endsWith('/pyr_unibague_current_roles')) return route.fulfill({ json: [role] })
    if (url.pathname.endsWith('/PYRUnibague_AcademicPeriods')) return route.fulfill({ json: [{ id: 'period', name: 'Periodo de prueba', is_current: true }] })
    if (url.pathname.endsWith('/PYRUnibague_MatchingRuns')) return route.fulfill({ json: [{ id: 'run', academic_period_id: 'period', status: 'completed', created_at: '2026-10-01T12:00:00Z' }] })
    if (url.pathname.endsWith('/pyr_unibague_assignment_snapshot')) {
      const body = request.postDataJSON(); const snapshot = { ...structuredClone(data), revision: `revision-${revision}`, run: body.p_run_id ? data.run : null, candidates: body.p_run_id ? data.candidates : [] }
      return route.fulfill({ json: snapshot })
    }
    if (/\/pyr_unibague_(confirm_assignment(_batch)?|reassign_assignment|unassign_assignment)$/.test(url.pathname)) {
      const body = request.postDataJSON()
      if (state.staleNext || body.p_revision !== `revision-${revision}`) { state.staleNext = false; return route.fulfill({ status: 400, json: { code: 'P0001', message: 'ASSIGNMENT_PROPOSAL_STALE' } }) }
      const actions: Record<string, unknown>[] = body.p_actions ?? [body.p_action]; writes.push(actions)
      for (const a of actions) {
        if (a.kind === 'reassign' || a.kind === 'unassign') {
          const prior = data.existing.find(x => x.id === a.assignment_id); if (prior) prior.active = false
          const row = history.find(x => x.id === a.assignment_id); if (row) { row.is_active = false; row.unassigned_at = new Date().toISOString() }
        }
        if (a.kind === 'unassign') continue
        const id = crypto.randomUUID(); data.existing.push({ id, studentId: String(a.student_id), positionId: String(a.position_id), periodId: 'period', active: true })
        history.push({ id, student_id: a.student_id, project_position_id: a.position_id, academic_period_id: 'period', is_active: true, source: a.source, assigned_at: new Date().toISOString(), unassigned_at: null })
        events.push({ id: crypto.randomUUID(), assignment_id: id, actor_user_id: user.id, event_type: 'ASSIGNED', reason_code: a.reason_code ?? null, reason_text: a.reason_text ?? null, created_at: new Date().toISOString() })
      }
      revision++; return route.fulfill({ json: actions.map(() => ({ assignment_id: crypto.randomUUID() })) })
    }
    const table = url.pathname.endsWith('/PYRUnibague_Assignments') ? history : url.pathname.endsWith('/PYRUnibague_AssignmentEvents') ? events : null
    if (table) {
      const filtered = table.filter(row => [...url.searchParams].every(([key, value]) => value.startsWith('eq.') ? String(row[key]) === value.slice(3) : true))
      const offset = Number(url.searchParams.get('offset') ?? 0); const limit = Number(url.searchParams.get('limit') ?? 25)
      return route.fulfill({ headers: { 'Content-Range': `${offset}-${offset + limit - 1}/${filtered.length}`, 'Access-Control-Expose-Headers': 'Content-Range' }, json: filtered.slice(offset, offset + limit) })
    }
    return route.fulfill({ status: 400, json: { message: 'Unknown isolated test endpoint' } })
  })
  return { calls, writes, history, state }
}
async function calculate(page: Page) {
  await page.goto('/tests/assignments/harness.html'); await expect(page.getByRole('heading', { name: 'Asignaciones', exact: true })).toBeVisible()
  await page.getByLabel('Ejecución completada').selectOption('run'); await page.getByRole('button', { name: 'Optimizar y revisar' }).click(); await page.getByRole('button', { name: 'Calcular propuesta' }).click()
  await expect(page.getByText(/Borrador sin persistir/)).toBeVisible()
}
test('global draft, administrator approval, capacity reload and paginated historical events', async ({ page }) => {
  const fixture = await api(page); await calculate(page)
  await expect(page.getByText(/compatibilidad total 186.00/)).toBeVisible(); expect(fixture.writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Revisar y confirmar lote (2)' }).click(); const dialog = page.getByRole('dialog', { name: 'Confirmar decisión administrativa' }); await expect(dialog).toBeVisible()
  expect(fixture.writes).toHaveLength(0); await dialog.getByRole('button', { name: 'Confirmar decisión' }).click()
  await expect(page.getByText('Decisión confirmada. Cupos e historial actualizados.')).toBeVisible()
  expect(fixture.writes[0]!.map(a => [a.student_id, a.position_id])).toEqual([['s0', 'p1'], ['s1', 'p0']])
  await page.getByRole('button', { name: 'Historial', exact: true }).click(); await expect(page.getByRole('button', { name: 'Ver eventos' })).toHaveCount(2)
  await page.getByLabel('Historial del estudiante').selectOption('s0'); await expect(page.getByRole('button', { name: 'Ver eventos' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Ver eventos' }).click(); await expect(page.getByRole('heading', { name: 'Eventos administrativos' })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
test('stale batch requires recalculation and never claims success', async ({ page }) => {
  const fixture = await api(page); await calculate(page); fixture.state.staleNext = true
  await page.getByRole('button', { name: 'Revisar y confirmar lote (2)' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Confirmar decisión' }).click()
  await expect(page.getByText('Propuesta desactualizada')).toBeVisible(); expect(fixture.writes).toHaveLength(0)
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Revisar y confirmar lote (2)' })).toBeDisabled()
  await page.getByRole('button', { name: 'Actualizar cupos y descartar borrador' }).click(); await page.getByRole('button', { name: 'Calcular propuesta' }).click(); await expect(page.getByText(/compatibilidad total 186.00/)).toBeVisible()
})
test('manual unscored assignment, reason, keyboard confirmation, reassignment and withdrawal', async ({ page }) => {
  const fixture = await api(page); await page.goto('/tests/assignments/harness.html'); await page.getByRole('button', { name: 'Intervención manual', exact: true }).click()
  await page.getByLabel('Estudiante a intervenir').selectOption('s0'); await page.getByLabel('Destino manual').selectOption('p0'); await page.getByLabel('Motivo de intervención').selectOption('OTHER'); await page.getByLabel('Justificación').fill('Caso autorizado para prueba')
  await expect(page.getByRole('button', { name: 'Revisar asignación manual' })).toBeDisabled(); await page.getByLabel('Confirmo asignación manual sin compatibilidad histórica verificable').check()
  await page.getByRole('button', { name: 'Revisar asignación manual' }).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await expect(page.getByText('Decisión confirmada. Cupos e historial actualizados.')).toBeVisible()
  expect(fixture.writes[0]![0]).toMatchObject({ source: 'MANUAL', reason_code: 'OTHER', allow_unscored: true })
  await page.getByLabel('Destino manual').selectOption('p1'); await page.getByLabel('Motivo de intervención').selectOption('COORDINATION_REQUEST'); await page.getByLabel('Justificación').fill('Reasignación de prueba'); await page.getByLabel('Confirmo asignación manual sin compatibilidad histórica verificable').check()
  await page.getByRole('button', { name: 'Revisar reasignación' }).click(); await dialog.getByRole('button', { name: 'Confirmar decisión' }).click(); await expect.poll(() => fixture.writes.length).toBe(2)
  await page.getByLabel('Motivo de intervención').selectOption('DATA_CORRECTION'); await page.getByLabel('Justificación').fill('Retiro de prueba'); await page.getByRole('button', { name: 'Revisar retiro' }).click(); await dialog.getByRole('button', { name: 'Confirmar decisión' }).click(); await expect.poll(() => fixture.writes.length).toBe(3)
  expect(fixture.writes.map(actions => actions[0]!.kind)).toEqual(['confirm', 'reassign', 'unassign']); expect(fixture.history).toHaveLength(2); expect(fixture.history.every(a => !a.is_active)).toBe(true)
})
test('proposal tables paginate and remain accessible on mobile', async ({ page }) => {
  await api(page, 'ADMIN', true); await calculate(page)
  await page.screenshot({ path: 'tests/assignments/test-results/desktop.png', fullPage: true })
  const table = page.getByRole('table', { name: 'Propuestas agrupadas por organización y proyecto' }); await expect(table.locator('tbody tr')).toHaveCount(25)
  await page.getByRole('button', { name: 'Siguiente', exact: true }).first().click(); await expect(table.locator('tbody tr')).toHaveCount(6)
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.screenshot({ path: 'tests/assignments/test-results/mobile.png', fullPage: true })
})
test('non-admin UI denies access before reading assignment state', async ({ page }) => {
  const fixture = await api(page, 'STUDENT'); await page.goto('/tests/assignments/harness.html'); await expect(page.getByText('Asignaciones requiere el rol ADMIN.')).toBeVisible()
  expect(fixture.calls.some(path => path.endsWith('/pyr_unibague_assignment_snapshot'))).toBe(false)
})
