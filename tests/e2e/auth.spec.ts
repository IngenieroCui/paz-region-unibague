import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
// Browser integration uses SDK calls against isolated HTTP fixtures, never a real Auth project.
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'test@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { role: 'ADMIN' } }
const accessToken = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'fixture-signature'].join('.')
async function api(page: Page, roles: string[], failLogin = false) {
  await page.route('https://pyr-e2e.example.test/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/rest/v1/') && !url.pathname.includes('/rpc/')) return route.fulfill({ json: url.pathname.endsWith('/PYRUnibague_UserProfiles') ? { user_id: user.id, display_name: null } : [] })
    if (url.pathname.endsWith('/pyr_unibague_current_roles')) return route.fulfill({ json: roles })
    if (url.pathname.endsWith('/token')) {
      if (failLogin) return route.fulfill({ status: 400, json: { error: 'invalid_grant', error_description: 'Invalid login credentials' } })
      return route.fulfill({ json: { access_token: accessToken, refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer', user } })
    }
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user })
    if (url.pathname.endsWith('/logout') || url.pathname.endsWith('/recover')) return route.fulfill({ json: {} })
    return route.fulfill({ status: 400, json: { message: 'Unrecognized test API endpoint' } })
  })
}
async function login(page: Page) {
  await page.goto('/login/institucional')
  await page.getByLabel('Correo electrónico').fill('test@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
}
test('single role login, clean production workspace, denied admin, logout', async ({ page }) => {
  await api(page, ['STUDENT'])
  await login(page)
  await expect(page).toHaveURL(/\/app\/student$/)
  await expect(page.getByRole('heading', { name: 'Tu espacio en Paz y Región', exact: true })).toBeVisible()
  await expect(page.getByText('Vista de desarrollo')).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
  await page.goto('/app/admin')
  await expect(page).toHaveURL(/\/unauthorized$/)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/app/student')
  await expect(page).toHaveURL(/\/login$/)
})
test('zero roles denies workspace despite metadata claiming ADMIN', async ({ page }) => {
  await api(page, [])
  await login(page)
  await expect(page).toHaveURL(/\/unauthorized$/)
})
test('multirole choice navigates without changing permissions', async ({ page }) => {
  await api(page, ['STUDENT','ADMIN'])
  await login(page)
  await expect(page).toHaveURL(/\/select-role$/)
  await page.getByRole('link', { name: 'Universidad', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/admin$/)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
})
test('persisted ADMIN opens the production matching module from navigation', async ({ page }) => {
  await api(page, ['ADMIN'])
  await login(page)
  await expect(page).toHaveURL(/\/app\/admin$/)
  await page.getByRole('link', { name: 'Matching', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/admin\/matching$/)
  await expect(page.getByRole('heading', { name: 'Matching', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sin periodos académicos' })).toBeVisible()
  await expect(page.getByText('Motor de matching pendiente de integración P5')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
})
test('matching denies a persisted STUDENT before requesting matching data', async ({ page }) => {
  const matchingRequests: string[] = []
  page.on('request', request => {
    if (/\/PYRUnibague_Matching|\/matching-run/.test(request.url())) matchingRequests.push(request.url())
  })
  await api(page, ['STUDENT'])
  await login(page)
  await expect(page).toHaveURL(/\/app\/student$/)
  await page.goto('/app/admin/matching')
  await expect(page).toHaveURL(/\/unauthorized$/)
  expect(matchingRequests).toEqual([])
})
test('matching requires a session even when opened directly', async ({ page }) => {
  await api(page, ['ADMIN'])
  await page.goto('/app/admin/matching')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Matching', exact: true })).toHaveCount(0)
})
test('login errors are accessible and recovery sends a real SDK request', async ({ page }) => {
  await api(page, [], true)
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Revisa tus credenciales')
  await page.goto('/forgot-password')
  await page.getByLabel('Correo electrónico').fill('test@example.test')
  const request = page.waitForRequest('**/auth/v1/recover**')
  await page.getByRole('button', { name: 'Enviar instrucciones' }).click()
  expect((await request).method()).toBe('POST')
  await expect(page.getByText('Solicitud recibida')).toBeVisible()
})
test('PKCE recovery callback ignores external destination, updates password and logs out', async ({ page }) => {
  await api(page, [])
  await page.goto('/forgot-password')
  await page.getByLabel('Correo electrónico').fill('test@example.test')
  await page.getByRole('button', { name: 'Enviar instrucciones' }).click()
  await expect(page.getByText('Solicitud recibida')).toBeVisible()
  // The recovery request above stores the actual SDK PKCE verifier in this browser.
  await page.goto('/auth/callback?code=fixture-code&next=https://evil.example')
  await expect(page).toHaveURL(/\/reset-password$/)
  await page.getByLabel('Nueva contraseña').fill('new-password123')
  await page.getByLabel('Confirma la contraseña').fill('new-password123')
  const update = page.waitForRequest(request => request.url().endsWith('/auth/v1/user') && request.method() === 'PUT')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await update
  await expect(page.getByText('Contraseña actualizada')).toBeVisible()
})
