import { expect, test } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
const routes = ['/', '/login', '/forgot-password', '/dev/student', '/dev/organization', '/dev/admin']
for (const width of [1440, 1024, 768, 390, 320]) {
  test('responsive and accessible surfaces at ' + width + 'px', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 960 })
    for (const route of routes) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, route + ' has page overflow').toBe(false)
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(audit.violations, route + ' accessibility violations').toEqual([])
    }
    expect(errors).toEqual([])
  })
}
test('keyboard navigation, mobile drawer focus and preview navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dev/student')
  await expect(page.getByRole('heading', { name: 'Hola, estudiante.' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir navegación' })).toBeFocused()
  await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Mi perfil' }).click()
  await expect(page.getByRole('heading', { name: 'Mi perfil', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.locator('#main')).toBeFocused()
})
test('administrator filters are functional', async ({ page }) => {
  await page.goto('/dev/admin')
  await page.getByLabel('Tipo de elemento').selectOption('Proyecto')
  await expect(page.getByRole('status')).toHaveText('1 de 3 elementos de ejemplo')
  await page.getByLabel('Buscar en los ejemplos').fill('sin coincidencias')
  await expect(page.getByRole('heading', { name: 'No hay coincidencias' })).toBeVisible()
})
