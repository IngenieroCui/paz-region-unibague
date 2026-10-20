// Real browser, real Supabase. No HTTP fixtures, traces, credential screenshots or saved sessions.
import { chromium, expect as playwrightExpect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { readManifest, save, ref, SCENARIO } from './p12-context.mjs'

const ledger = JSON.parse(await readFile(process.env.PYR_P12_LEDGER || 'work/p11/cuentas-test.local.json', 'utf8'))
if (ledger.project_ref !== ref) throw Error('Proyecto incompatible')
const m = await readManifest()
const base = process.env.PYR_TEST_BASE_URL || 'http://127.0.0.1:5892'
const hosted = process.env.PYR_HOSTED_BASE_URL || 'https://pazregionunibague-sepia.vercel.app'
const out = 'work/p12/browser'
await mkdir(out, { recursive: true })
const results = [], measurements = []
const expect = playwrightExpect.configure({ timeout: 30000 })
let browser, child
try {
  // Verify the hosted entry point before submitting any account credentials.
  const hostedResponse = await fetch(hosted + '/login/institucional', { signal: AbortSignal.timeout(15000) })
  results.push({ label: 'Puerta institucional hospedada', status: hostedResponse.ok ? 'READY_FOR_BROWSER' : 'BLOCKED', http: hostedResponse.status, url: hosted + '/login/institucional' })
  if (!process.env.PYR_TEST_BASE_URL) {
    child = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5892', '--strictPort'], { windowsHide: true, stdio: 'ignore' })
    for (let i=0; i<80; i++) { try { if ((await fetch(base)).ok) break } catch {} await delay(200) }
  }
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const [index, account] of ledger.accounts.entries()) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' })
    const page = await ctx.newPage(), errors = [], foreignHosts = []
    page.on('pageerror', e => errors.push(e.name))
    await ctx.route('**/*', route => {
      const host = new URL(route.request().url()).hostname
      if (host.endsWith('.supabase.co') && host !== ref + '.supabase.co') { foreignHosts.push(host); return route.abort() }
      return route.continue()
    })
    const root = '/app/' + account.role.toLowerCase()
    async function screen(route, label, assertion) {
      const start = performance.now()
      await page.goto(base + route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('main h1')).toBeVisible({ timeout: 30000 })
      await expect(page.locator('main .skeleton, main .loading-state')).toHaveCount(0)
      await expect(page.getByText('No pudimos cargar la información', { exact: true })).toHaveCount(0)
      if (assertion) await assertion()
      const ms = Math.round(performance.now() - start)
      const counts = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('.supabase.co/')).map(r => ({ kind: new URL(r.name).pathname.split('/').at(-1), bytes: r.transferSize })))
      measurements.push({ account_index: index, role: account.role, label, ms, supabase_requests: counts.length, transfer_bytes: counts.reduce((n,r) => n + r.bytes, 0) })
      for (const width of [1440,390]) {
        await page.setViewportSize({ width, height: 960 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow ' + label).toBe(true)
        await page.screenshot({ path: `${out}/${index}-${label}-${width}.png`, fullPage: true })
      }
      await page.setViewportSize({ width: 1440, height: 960 })
      results.push({ label, role: account.role, account_index: index, status: 'PASS', data: 'asserted persisted scenario fields; not page-open only' })
    }
    try {
      await page.goto(base + (account.role === 'ORGANIZATION' ? '/login/organizaciones' : '/login/institucional'), { waitUntil: 'domcontentloaded' })
      await page.getByLabel('Correo electrónico', { exact: true }).fill(account.email)
      await page.getByLabel('Contraseña', { exact: true }).fill(account.password)
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
      await page.waitForURL(base + root, { timeout: 45000, waitUntil: 'domcontentloaded' })
      if (account.role === 'STUDENT') {
        const n = Number(account.email.match(/estudiante(\d*)@/)[1] || 1)
        await screen(root, 'student-dashboard', async () => {
          await expect(page.getByText('2026B — Piloto TEST', { exact: true })).toBeVisible()
          await expect(page.getByText('Sin periodo actual', { exact: true })).toHaveCount(0)
          await expect(page.getByText(n === 4 ? 'No habilitada' : 'Habilitada', { exact: true })).toBeVisible()
        })
        await screen(root + '/profile', 'student-profile', async () => {
          await expect(page.getByLabel('Código estudiantil', { exact: true })).toHaveValue('TEST-PYR-2026B-E' + n)
          await expect(page.getByLabel('Programa académico', { exact: true })).not.toHaveValue('')
          if (n === 2) { await expect(page.getByLabel('GitHub · Opcional', { exact: true })).toHaveValue(''); await expect(page.getByLabel('Programa académico').locator('option:checked')).toContainText('Comunicación Social') }
        })
        await screen(root + '/documents', 'student-documents', async () => { await expect(page.getByRole('heading', { name: SCENARIO + '-TEST.pdf', exact: true })).toBeVisible() })
      } else if (account.role === 'ORGANIZATION') {
        await screen(root, 'organization-dashboard', async () => { await expect(page.getByRole('heading', { name: 'Estado administrativo', exact: true })).toBeVisible(); await expect(page.locator('main h1')).toContainText(account.email.includes('entidad2@') ? 'TEST P11 Organización 2' : 'TEST P11 Organización 1') })
        await screen(root + '/reviews', 'organization-reviews', async () => { await expect(page.getByRole('heading', { name: 'Historial de revisión', exact: true })).toBeVisible(); await expect(page.getByRole('definition').first()).not.toBeEmpty() })
        await screen(root + '/documents', 'organization-documents', async () => { await expect(page.getByRole('heading', { name: SCENARIO + '-TEST.pdf', exact: true })).toBeVisible() })
        if (account.email.includes('entidad2@')) {
          await screen(root + '/projects/' + m.project_id, 'project-positions', async () => { await expect(page.getByText(/Innovación y comunicación para el territorio/).first()).toBeVisible(); await expect(page.getByText(/Comunicación Social/).first()).toBeVisible() })
          await page.emulateMedia({ media: 'print' }); await page.pdf({ path: out + '/institutional-sheet.pdf', format: 'A4', printBackground: true }); await page.emulateMedia({ media: 'screen' })
        }
      } else if (account.role === 'ADVISOR') {
        await screen(root, 'advisor-dashboard', async () => { await expect(page.getByText('1 registro(s) vigentes.').first()).toBeVisible() })
        await screen(root + '/students', 'advisor-students', async () => { await expect(page.getByText(/Programa sin registrar/)).toHaveCount(0); await expect(page.getByText(/Semestre 8|Semestre 9/).first()).toBeVisible() })
        await screen(root + '/organizations', 'advisor-organizations', async () => { await expect(page.getByText(/PYR-DEMO-2026B/).first()).toBeVisible() })
      } else {
        await screen(root, 'admin-dashboard', async () => { await expect(page.locator('main h2').first()).toBeVisible() })
        for (const route of ['students','organizations','matching','assignments','operations','audit']) await screen(root + '/' + route, 'admin-' + route, async () => {
          if (route === 'students') await expect(page.getByRole('link', { name: 'Pyrprueba estudiante (TEST)', exact: true })).toBeVisible()
          if (route === 'matching') {
            await page.getByRole('button', { name: 'Configuraciones', exact: true }).click()
            await expect(page.getByLabel('Configuración a editar').locator('option').filter({ hasText: 'Matching estructurado' })).toHaveCount(1)
          }
        })
      }
      await screen(root + '/notifications', 'notifications', async () => { await expect(page.locator('main h1')).toContainText(/notificaciones/i) })
      expect(errors).toEqual([]); expect(foreignHosts).toEqual([])
      const other = account.role === 'ADMIN' ? '/app/student' : '/app/admin'
      await page.goto(base + other, { waitUntil: 'domcontentloaded' }); await page.waitForURL(base + '/unauthorized', { waitUntil: 'domcontentloaded' })
      results.push({ label: 'Login, contenido, responsive y rol ajeno denegado', account_index: index, role: account.role, status: 'PASS' })
      console.log('PASS browser', index, account.role)
    } catch (error) { results.push({ label: 'Cuenta navegador', account_index: index, role: account.role, status: 'FAIL', error: error.message }); console.log('FAIL browser', index, account.role, error.message); process.exitCode = 1 }
    finally { await ctx.close() }
  }
} finally {
  await browser?.close()
  if (child && child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done }
  await save('browser-verification.local.json', { checked_at: new Date().toISOString(), base, hosted, results, measurements, limitations: ['Ningún alumno tiene asignación hasta disponer de matching real', 'Ciclos de capacidad/retiro y equipo final bloqueados por dependencias remotas', 'Tiempos de frontend local con Supabase real; no se presentan como tiempos hospedados'] })
}
