import { expect, test } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { p3Api, p3Login } from './p3-api.js'

test('student creates profile and handles absent catalogs without inventing data', async ({ page }) => {
  const api = await p3Api(page, 'STUDENT', { onboarding: true, emptyCatalogs: true }); await p3Login(page)
  await page.getByRole('link', { name: 'Crear mi perfil', exact: true }).click()
  await expect(page.getByText('Catálogo de programas pendiente')).toBeVisible()
  await page.getByLabel('Nombre visible').fill('Nombre actualizado'); await page.getByLabel('Código estudiantil').fill('TEST2'); await page.getByLabel('Semestre', { exact: true }).fill('5')
  await page.getByRole('button', { name: 'Guardar cambios' }).click(); await expect(page.getByText('Cambios guardados')).toBeVisible()
  expect(api.table('Students')[0]?.user_id).toBe(api.uid); expect(api.table('UserProfiles')[0]?.display_name).toBe('Nombre actualizado')
  await page.goto('/app/student'); await expect(page.getByText('Semestre 5', { exact: false })).toBeVisible()
})
test('student experience CRUD, inline dates and deletion confirmation', async ({ page }) => {
  const api = await p3Api(page, 'STUDENT'); await p3Login(page); await page.goto('/app/student/experience')
  await page.getByLabel('Título', { exact: true }).fill('Voluntariado'); await page.getByLabel('Fecha de inicio').fill('2026-05-01'); await page.getByLabel('Fecha de finalización').fill('2026-04-01')
  await page.getByRole('button', { name: 'Agregar experiencia' }).click(); await expect(page.getByText('La fecha final debe ser posterior o igual a la inicial.')).toBeVisible(); expect(api.table('StudentExperiences')).toHaveLength(0)
  await page.getByLabel('Es mi experiencia actual').check(); await page.getByRole('button', { name: 'Agregar experiencia' }).click(); await expect(page.getByRole('heading', { name: 'Voluntariado' })).toBeVisible()
  await page.getByRole('button', { name: 'Editar', exact: true }).click(); await page.getByLabel('Título', { exact: true }).fill('Voluntariado actual'); await page.getByRole('button', { name: 'Guardar experiencia' }).click(); await expect(page.getByRole('heading', { name: 'Voluntariado actual' })).toBeVisible()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Eliminar experiencia' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused()
  await page.keyboard.press('Escape'); expect(api.table('StudentExperiences')).toHaveLength(1)
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Sin experiencias' })).toBeVisible()
})
test('student skills, interests CRUD and ordered territorial preferences', async ({ page }) => {
  const api = await p3Api(page, 'STUDENT'); await p3Login(page); await page.goto('/app/student/skills')
  await page.getByLabel('Buscar habilidades').fill('prueba'); await page.getByLabel('Habilidad', { exact: true }).selectOption('skill'); await page.getByLabel('Evidencia / descripción').fill('Evidencia'); await page.getByRole('button', { name: 'Agregar habilidad' }).click(); await expect(page.getByRole('heading', { name: 'Habilidad de prueba' })).toBeVisible()
  await expect(page.getByLabel('Habilidad', { exact: true }).getByRole('option', { name: 'Habilidad de prueba' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Editar evidencia' }).click(); await page.getByLabel('Evidencia / descripción').fill('Evidencia actualizada'); await page.getByRole('button', { name: 'Guardar evidencia' }).click(); await expect(page.getByText('Evidencia actualizada')).toBeVisible()
  for (const label of ['Ambiente','Educación']) { await page.getByLabel('Interés', { exact: true }).fill(label); await page.getByRole('button', { name: 'Agregar interés' }).click(); await expect(page.getByRole('heading', { name: new RegExp(label) })).toBeVisible() }
  await page.getByRole('button', { name: 'Subir interés Educación' }).click(); await expect(page.getByRole('heading', { name: '1. Educación' })).toBeVisible()
  await page.goto('/app/student/preferences')
  for (const id of [api.mid, api.mid.replace(/1$/, '2')]) { await page.getByLabel('Municipio preferido').selectOption(id); await page.getByRole('button', { name: 'Agregar preferencia' }).click(); await expect(page.getByText('Preferencias guardadas')).toBeVisible() }
  await page.getByRole('button', { name: 'Subir preferencia Municipio B' }).click(); await expect(page.getByRole('heading', { name: '1. Municipio B' })).toBeVisible()
  await page.getByRole('button', { name: 'Eliminar', exact: true }).first().click(); await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click(); await expect(page.getByRole('heading', { name: '1. Municipio A' })).toBeVisible()
})
for (const role of ['STUDENT','ORGANIZATION'] as const) test(`${role} private upload, fresh signed URL and deletion`, async ({ page }) => {
  const api = await p3Api(page, role); await p3Login(page); await page.goto(`/app/${role.toLowerCase()}/documents`)
  if (role === 'ORGANIZATION') await page.getByLabel('Categoría').fill('Soporte opcional')
  await page.getByLabel('Archivo', { exact: true }).setInputFiles({ name: 'hoja de vida.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 test') })
  await page.getByRole('button', { name: 'Subir documento', exact: true }).click(); await expect(page.getByRole('heading', { name: 'hoja_de_vida.pdf' })).toBeVisible()
  const doc = api.table(role === 'STUDENT' ? 'StudentDocuments' : 'OrganizationDocuments')[0]!
  expect(String(doc.object_path)).toMatch(new RegExp('^' + (role === 'STUDENT' ? api.sid : api.oid) + '/'))
  const popup = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Abrir', exact: true }).click(); const opened = await popup; await opened.close()
  await page.getByRole('button', { name: 'Descargar', exact: true }).click()
  await expect.poll(() => api.calls.filter(call => call.path.includes('/object/sign/')).length).toBe(2)
  const signed = api.calls.filter(call => call.path.includes('/object/sign/')); expect(signed[0]?.body).toMatchObject({ expiresIn: 60 })
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click(); await expect(page.getByRole('heading', { name: 'No hay documentos' })).toBeVisible()
})
test('organization onboarding uses RPC, protects administrative fields and reads reviews', async ({ page }) => {
  const api = await p3Api(page, 'ORGANIZATION', { onboarding: true }); await p3Login(page)
  await expect(page.getByRole('heading', { name: 'Registra tu organización' })).toBeVisible(); await page.getByLabel('Nombre legal').fill('Entidad nueva'); await page.getByLabel('Tipo de organización').selectOption('type'); await page.getByLabel('Municipio', { exact: true }).selectOption(api.mid); await page.getByRole('button', { name: 'Registrar organización' }).click(); await expect(page.getByRole('heading', { name: 'Entidad nueva' })).toBeVisible()
  expect(api.calls.filter(call => call.path.endsWith('/pyr_unibague_register_organization'))).toHaveLength(1)
  await page.goto('/app/organization/profile'); await page.getByLabel('Descripción', { exact: true }).fill('Perfil editado'); await page.getByRole('button', { name: 'Guardar organización' }).click(); await expect(page.getByText('Cambios guardados')).toBeVisible()
  const edit = api.calls.find(call => call.method === 'PATCH' && call.path.endsWith('/PYRUnibague_Organizations'))?.body
  expect(edit).not.toHaveProperty('status'); expect(edit).not.toHaveProperty('verified_at'); expect(edit).not.toHaveProperty('created_by')
  api.table('OrganizationReviews').push({ id: 'review', organization_id: api.oid, decision: 'changes_requested', notes: 'Actualiza la descripción.', created_at: '2026-10-01T12:00:00Z' })
  await page.goto('/app/organization/reviews'); await expect(page.getByText('Cambios solicitados')).toBeVisible(); await expect(page.getByText('Actualiza la descripción.')).toBeVisible(); expect(api.calls.some(call => call.path.endsWith('/PYRUnibague_OrganizationReviews') && call.method !== 'GET')).toBe(false)
})
test('unsaved edits block navigation and allow cancel with focus retained', async ({ page }) => {
  await p3Api(page, 'STUDENT'); await p3Login(page); await page.goto('/app/student/profile'); await page.getByLabel('Bio', { exact: true }).fill('Cambios sin guardar')
  await page.getByRole('link', { name: 'Experiencia', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Hay cambios sin guardar' })).toBeVisible(); await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(page.getByLabel('Bio', { exact: true })).toHaveValue('Cambios sin guardar')
  await page.getByRole('link', { name: 'Experiencia', exact: true }).click(); await page.getByRole('button', { name: 'Salir sin guardar' }).click(); await expect(page.getByRole('heading', { name: 'Experiencia', exact: true })).toBeVisible()
})
test('nonmanager organization consults profile but cannot edit or access private files', async ({ page }) => {
  await p3Api(page, 'ORGANIZATION', { readOnly: true }); await p3Login(page); await page.goto('/app/organization/profile'); await expect(page.getByLabel('Nombre legal')).toBeDisabled(); await expect(page.getByRole('button', { name: 'Guardar organización' })).toHaveCount(0)
  await page.goto('/app/organization/documents'); await expect(page.getByRole('button', { name: 'Subir documento', exact: true })).toHaveCount(0)
})
test('organization selection persists across workspace navigation and reload', async ({ page }) => {
  const api = await p3Api(page, 'ORGANIZATION')
  api.table('Organizations').push({ ...api.table('Organizations')[0], id: 'other-org', legal_name: 'Otra entidad', display_name: 'Otra entidad' })
  api.table('OrganizationMembers').push({ id: 'other-member', organization_id: 'other-org', user_id: api.uid, can_manage: true, status: 'active' })
  await p3Login(page); await page.getByLabel('Organización activa').selectOption('other-org'); await expect(page.getByRole('heading', { name: 'Otra entidad' })).toBeVisible()
  await page.getByRole('link', { name: 'Perfil', exact: true }).click(); await expect(page.getByLabel('Nombre legal')).toHaveValue('Otra entidad'); await page.reload(); await expect(page.getByLabel('Organización activa')).toHaveValue('other-org')
  await page.getByLabel('Descripción', { exact: true }).fill('Nueva descripción'); await page.getByRole('button', { name: 'Guardar organización' }).click(); await expect(page.getByText('Cambios guardados')).toBeVisible()
  expect(api.table('Organizations')[0]?.description).toBe('Descripción'); expect(api.table('Organizations')[1]?.description).toBe('Nueva descripción')
})
test('student loading error retries and upload metadata failure is compensated visibly', async ({ page }) => {
  const api = await p3Api(page, 'STUDENT'); api.failNext('Students'); await p3Login(page)
  await expect(page.getByRole('heading', { name: 'No se pudo completar la operación. Reintenta.' })).toBeVisible(); await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Mi perfil', exact: true })).toBeVisible()
  await page.goto('/app/student/documents'); await page.getByLabel('Archivo', { exact: true }).setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') }); api.failNext('StudentDocuments'); await page.getByRole('button', { name: 'Subir documento', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('el archivo subido se retiró'); expect(api.table('StudentDocuments')).toHaveLength(0); expect(api.calls.some(call => call.method === 'DELETE' && call.path.includes('/storage/v1/object/'))).toBe(true)
})
for (const width of [1440,768,320]) test(`P3 responsive, keyboard navigation and accessibility at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 950 })
  await p3Api(page, 'STUDENT'); await p3Login(page)
  for (const section of ['', 'profile','experience','skills','preferences','documents']) {
    await page.goto('/app/student' + (section ? '/' + section : '')); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await expect(page.getByText('Cargando perfil')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    if (section === 'profile') await page.screenshot({ path: testInfo.outputPath('student-profile.png'), fullPage: true })
  }
  if (width === 320) { await page.getByRole('button', { name: 'Abrir navegación' }).click(); await page.getByRole('dialog').getByRole('link', { name: 'Preferencias', exact: true }).click(); await expect(page.locator('#main')).toBeFocused() }
  await page.context().clearCookies(); await page.evaluate(() => localStorage.clear()); await page.unrouteAll({ behavior: 'wait' }); await p3Api(page, 'ORGANIZATION'); await p3Login(page)
  for (const section of ['', 'profile','documents','reviews']) {
    await page.goto('/app/organization' + (section ? '/' + section : '')); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await expect(page.getByText('Cargando organización')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    if (section === '') await page.screenshot({ path: testInfo.outputPath('organization-home.png'), fullPage: true })
  }
})
