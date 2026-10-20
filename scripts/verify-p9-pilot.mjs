// Real hosted Auth/RLS checks. Credentials remain local; no traces or network bodies.
import { chromium, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { publicClient, ref } from './supabase-admin.mjs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'


const base = process.env.PYR_TEST_BASE_URL || 'http://localhost:5173'
const out = resolve('work/p11/browser')
await mkdir(out + '/screens', { recursive: true })
const ledger = JSON.parse(await readFile('work/p11/cuentas-test.local.json', 'utf8'))
if (ledger.project_ref !== ref) throw Error('Registro de proyecto diferente.')
const results = []
const paths = { ADMIN: 'admin', ADVISOR: 'advisor', ORGANIZATION: 'organization', STUDENT: 'student' }
const totals = { STUDENT: 4, ADVISOR: 2, ORGANIZATION: 2, ADMIN: 1 }
for (const [role, count] of Object.entries(totals)) expect(ledger.accounts.filter(a => a.role === role)).toHaveLength(count)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
async function settle(page) {
  await expect(page.getByRole('heading', { level: 1 }), new URL(page.url()).pathname).toBeVisible({ timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.getByRole('heading', { level: 1 }), new URL(page.url()).pathname + ' settled').toBeVisible()
  await expect(page.getByText('No tienes permiso para esta operación.', { exact: true })).toHaveCount(0)
}
async function audit(page, label) {
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations
  expect(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), label).toEqual([])
}
async function responsive(page, label) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' overflow ' + width).toBe(true)
  }
}
try {
  const publicContext = await browser.newContext()
  const publicPage = await publicContext.newPage()
  for (const route of ['/', '/login', '/forgot-password', '/reset-password', '/unauthorized', '/not-found']) {
    await publicPage.goto(base + route); await settle(publicPage)
    await responsive(publicPage, route); await audit(publicPage, route)
    if (['/', '/login', '/forgot-password'].includes(route)) await publicPage.screenshot({ path: out + '/screens/' + (route === '/' ? 'home' : route.slice(1)) + '.png', fullPage: true })
    results.push({ scope: 'public', route, status: 'PASS' })
  }
  await publicContext.close()
  const seenRoles = new Set()
  for (const account of ledger.accounts) {
    const api = await publicClient()
    const login = await api.auth.signInWithPassword({ email: account.email, password: account.password })
    expect(login.error).toBeNull(); expect(login.data.user.id).toBe(account.user_id)
    const roles = await api.rpc('pyr_unibague_current_roles')
    expect(roles.error).toBeNull(); expect(roles.data).toEqual([account.role])
    const profile = await api.from('PYRUnibague_UserProfiles').select('display_name,institutional_email').eq('user_id', account.user_id).single()
    expect(profile.error).toBeNull(); expect(profile.data.display_name).toContain('(TEST)'); expect(profile.data.institutional_email).toBe(account.email)
    await api.auth.signOut()
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await ctx.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(base + (account.role === 'ORGANIZATION' ? '/login/organizaciones' : '/login/institucional'))
    await page.getByLabel('Correo electrónico', { exact: true }).fill(account.email)
    await page.getByLabel('Contraseña', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
    const space = '/app/' + paths[account.role]
    await page.waitForURL(base + space, { timeout: 20000 }); await settle(page)
    await responsive(page, account.role)
    if (!seenRoles.has(account.role)) {
      await audit(page, account.role)
      await page.screenshot({ path: out + '/screens/' + paths[account.role] + '-1440.png', fullPage: true })
      await page.setViewportSize({ width: 390, height: 960 })
      await page.screenshot({ path: out + '/screens/' + paths[account.role] + '-390.png', fullPage: true })
      await page.getByRole('button', { name: 'Abrir navegación' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Abrir navegación' })).toBeFocused()
      await page.setViewportSize({ width: 1440, height: 960 })
      const links = await page.locator('.desktop-sidebar nav a').evaluateAll(a => a.map(el => el.getAttribute('href')))
      for (const route of [...links, space + '/notifications']) {
        await page.goto(base + route); await settle(page); await responsive(page, route); await audit(page, route)
        results.push({ scope: account.role, route, status: 'PASS' })
      }
      seenRoles.add(account.role)
    }
    await page.goto(base + space); await settle(page); await page.reload(); await settle(page)
    expect(new URL(page.url()).pathname).toBe(space)
    for (const other of Object.keys(paths).filter(r => r !== account.role)) {
      await page.goto(base + '/app/' + paths[other]); await page.waitForURL(base + '/unauthorized')
    }
    await page.goto(base + space); await settle(page)
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(); await page.waitForURL(base + '/login')
    await page.goto(base + space); await page.waitForURL(/\/login/)
    expect(errors).toEqual([])
    results.push({ scope: 'account', email: account.email, role: account.role, authProfileRoles: 'PASS', browserLogin: 'PASS', responsive: '320/390/768/1440', guards: '3 forbidden roles rejected', persistence: 'PASS', logout: 'PASS', status: 'PASS' })
    await ctx.close()
    console.log('PASS', account.role, account.email)
  }
  // Optional existing P8 fixtures: populated journeys are read-only.
  if (process.env.PYR_P8_FIXTURES) {
    const f = JSON.parse(await readFile(process.env.PYR_P8_FIXTURES, 'utf8'))
    if (f.project_ref !== ref) throw Error('Fixtures de proyecto diferente.')
    const routes = {
      admin: ['/app/admin/matching', '/app/admin/assignments', '/app/admin/operations?period=' + f.period.id, '/app/admin/audit'],
      orgA: ['/app/organization/projects/' + f.projects[0].id, '/app/organization/calls', '/app/organization/groups'],
      advisorA: ['/app/advisor/students', '/app/advisor/projects'],
      studentA: ['/app/student/assignment?period=' + f.period.id, '/app/student/notifications', '/app/student/profile'],
    }
    for (const [tag, list] of Object.entries(routes)) {
      const u = f.users.find(u => u.tag === tag)
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } }), page = await ctx.newPage()
      await page.goto(base + '/login/institucional'); await page.getByLabel('Correo electrónico', { exact: true }).fill(u.email); await page.getByLabel('Contraseña', { exact: true }).fill(u.password); await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
      await page.waitForURL(/\/app\//)
      for (const route of list) {
        await page.goto(base + route); await settle(page); await responsive(page, route); await audit(page, route)
        await expect(page.getByText('No pudimos cargar la información', { exact: true })).toHaveCount(0)
        await page.screenshot({ path: out + '/screens/p8-' + tag + '-' + new URL(base + route).pathname.split('/').at(-1) + '.png', fullPage: true })
        if (route.includes('/projects/') && tag === 'orgA') {
          await expect(page.getByRole('heading', { name: 'Ficha institucional del proyecto' })).toBeVisible()
          await page.emulateMedia({ media: 'print' }); await page.pdf({ path: out + '/screens/institutional-sheet.pdf', format: 'A4', printBackground: true }); await page.emulateMedia({ media: 'screen' })
        }
        results.push({ scope: 'P8 populated read-only', tag, route, status: 'PASS' })
      }
      await ctx.close()
    }
  }
} catch (error) {
  results.push({ status: 'FAIL', error: error.message }); console.error(error.message); process.exitCode = 1
} finally {
  await writeFile(out + '/verification.json', JSON.stringify(results, null, 2)); await browser.close()
}
