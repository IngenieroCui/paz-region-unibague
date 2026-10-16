import { expect, test } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { p4Api } from './p4-api.js'
import { p3Login } from './p3-api.js'

test('Organization manager creates, edits and submits a full project/plaza profile',async({page})=>{
 const api=await p4Api(page,'ORGANIZATION');await p3Login(page);await page.goto('/app/organization/projects/new?organization='+api.oid)
 await page.getByLabel('Nombre del proyecto').fill('Proyecto nuevo P4');await page.getByRole('button',{name:'Guardar y añadir plazas'}).click()
 await page.getByRole('link',{name:'Configurar plazas',exact:true}).click();await expect(page).toHaveURL(/projects\/[0-9a-f-]{36}\?organization=/)
 await page.getByLabel('Nombre del proyecto').fill('Proyecto corregido P4');await page.getByRole('button',{name:'Guardar proyecto',exact:true}).click();await expect(page.getByRole('heading',{name:'Proyecto corregido P4',exact:true})).toBeVisible()
 await page.getByLabel('Título de la plaza').fill('Plaza nueva P4');await page.getByLabel('Capacidad',{exact:true}).fill('3');await page.getByRole('button',{name:'Añadir plaza',exact:true}).click()
 await page.getByText('Consultar o editar plaza y perfil requerido',{exact:true}).click()
 await page.getByLabel('Programa para la plaza').selectOption('program');await page.getByRole('button',{name:'Guardar programa',exact:true}).click()
 await page.getByLabel('Habilidad para la plaza').selectOption('skill');await page.getByLabel('Habilidad requerida',{exact:true}).uncheck();await page.getByRole('button',{name:'Guardar habilidad',exact:true}).click()
 await expect(page.getByText('Habilidad P4 · Deseable',{exact:true})).toBeVisible()
 await page.getByLabel('Requisito',{exact:true}).fill('Requisito P4');await page.getByLabel('Orden',{exact:true}).fill('1');await page.getByRole('button',{name:'Añadir requisito',exact:true}).click();await expect(page.getByText('1. Requisito P4 · Obligatorio',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Enviar para revisión',exact:true}).click();await page.getByRole('button',{name:'Confirmar estado'}).click();await expect(page.getByLabel('Nombre del proyecto')).toBeDisabled()
 expect(api.table('Projects').find(row=>row.name==='Proyecto corregido P4')?.status).toBe('submitted');expect(api.table('ProjectPositionPrograms')).toHaveLength(1);expect(api.table('ProjectPositionSkills')[0]?.is_required).toBe(false)
 await expect(page.getByRole('button',{name:'Aprobado',exact:true})).toHaveCount(0)
})
test('Organization member reads projects without management controls',async({page})=>{
 const api=await p4Api(page,'ORGANIZATION',{readOnly:true});await p3Login(page);await page.goto('/app/organization/projects');await expect(page.getByRole('link',{name:'Proyecto P4',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Crear proyecto',exact:true})).toHaveCount(0)
 await page.getByRole('link',{name:'Proyecto P4',exact:true}).click();await expect(page.getByLabel('Nombre del proyecto')).toBeDisabled();await expect(page.getByRole('button',{name:'Enviar para revisión'})).toHaveCount(0)
 expect(api.calls.some(call=>call.path.includes('Projects')&&call.method==='PATCH')).toBe(false)
})
test('Admin dashboard uses real counts and links pending queues',async({page})=>{
 await p4Api(page);await p3Login(page);await expect(page.getByRole('heading',{name:'Resumen administrativo'})).toBeVisible();await expect(page.getByText('Periodo actual: Periodo P4')).toBeVisible();await expect(page.getByRole('link',{name:'Revisar proyectos (1)'})).toBeVisible();await page.getByRole('link',{name:'Revisar proyectos (1)'}).click();await expect(page.getByLabel('Estado',{exact:true})).toHaveValue('submitted')
})
test('Admin student review confirms period eligibility and consults every section',async({page})=>{
 const api=await p4Api(page);await p3Login(page);await page.goto('/app/admin/students');await page.getByRole('link',{name:'Estudiante P4',exact:true}).click()
 await expect(page.getByText('Completitud UX ≠ elegibilidad administrativa.')).toBeVisible();for(const name of ['Experiencia','Habilidades','Intereses','Preferencias','Documentos privados'])await expect(page.getByRole('heading',{name,exact:true})).toBeVisible()
 await page.getByLabel('Estado de participación',{exact:true}).fill('reviewed');await page.getByLabel('Elegible para matching',{exact:true}).check();await page.getByRole('button',{name:'Revisar participación'}).click()
 expect(api.table('StudentPeriodParticipations')[0]?.eligible_for_matching).toBe(false)
 await page.getByRole('button',{name:'Guardar participación'}).click();await expect.poll(()=>api.table('StudentPeriodParticipations')[0]?.eligible_for_matching).toBe(true)
 await page.goto('/app/admin/students');await page.getByLabel('Elegibilidad',{exact:true}).selectOption('true');await expect(page.getByRole('link',{name:'Estudiante P4',exact:true})).toBeVisible()
})
test('Admin organization approval and revocation use transactional review RPC',async({page})=>{
 const api=await p4Api(page);await p3Login(page);await page.goto('/app/admin/organizations/'+api.oid);await page.getByLabel('Decisión',{exact:true}).selectOption('approved');await page.getByLabel('Observaciones',{exact:true}).fill('Aprobación P4');await page.getByRole('button',{name:'Revisar decisión'}).click();expect(api.table('OrganizationReviews')).toHaveLength(0);await page.getByRole('button',{name:'Publicar decisión'}).click();await expect.poll(()=>api.table('Organizations')[0]?.status).toBe('approved')
 await page.getByLabel('Decisión',{exact:true}).selectOption('changes_required');await page.getByRole('button',{name:'Revisar decisión'}).click();await page.getByRole('button',{name:'Publicar decisión'}).click();await expect.poll(()=>api.table('Organizations')[0]?.verified_at).toBeNull();expect(api.table('OrganizationReviews')).toHaveLength(2);expect(api.calls.filter(call=>call.path.endsWith('pyr_unibague_review_organization'))).toHaveLength(2)
})
test('Admin reviews projects and paginates large lists on the server',async({page})=>{
 const api=await p4Api(page,'ADMIN',{count:51});await p3Login(page);await page.goto('/app/admin/projects');await expect(page.getByRole('row')).toHaveCount(26);await page.getByRole('button',{name:'Siguiente',exact:true}).click();await expect(page.getByText('51 registros · Página 2 de 3')).toBeVisible();expect(api.calls.some(call=>call.query.includes('offset=25'))).toBe(true)
 await page.goto('/app/admin/projects/'+api.projectId);await expect(page.getByText('Pendiente de revisión administrativa')).toBeVisible();await page.getByRole('button',{name:'Aprobado',exact:true}).click();await page.getByRole('button',{name:'Confirmar estado'}).click();await expect.poll(()=>api.table('Projects')[0]?.status).toBe('approved')
})
test('Admin creates catalogs, deactivates referenced records and switches current period by RPC',async({page})=>{
 const api=await p4Api(page);await p3Login(page);await page.goto('/app/admin/settings?catalog=AcademicPeriods');await page.getByRole('button',{name:'Crear registro'}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Código',{exact:true}).fill('2027A');await dialog.getByLabel('Nombre',{exact:true}).fill('Periodo siguiente');await dialog.getByLabel('Estado',{exact:true}).fill('configured');await dialog.getByRole('button',{name:'Guardar cambios'}).click();await expect(dialog).not.toBeVisible()
 await page.getByRole('button',{name:'Establecer actual'}).click();await page.getByRole('button',{name:'Confirmar',exact:true}).click();await expect.poll(()=>api.table('AcademicPeriods').find(row=>row.is_current)?.name).toBe('Periodo siguiente');expect(api.calls.filter(call=>call.path.endsWith('pyr_unibague_set_current_academic_period'))).toHaveLength(1)
 await page.getByLabel('Catálogo o configuración').selectOption('AcademicPrograms');await page.getByRole('button',{name:'Desactivar',exact:true}).click();await page.getByRole('button',{name:'Confirmar',exact:true}).click();await expect.poll(()=>api.table('AcademicPrograms')[0]?.active).toBe(false)
})
test('Admin role actions demand strong ADMIN confirmation',async({page})=>{
 const api=await p4Api(page);await p3Login(page);await page.goto('/app/admin/users');const student=page.getByRole('row').filter({hasText:'Estudiante P4'});await student.getByRole('button',{name:'Asignar ADMIN',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Confirmar cambio de rol'}).click();await expect(dialog.getByText('Escribe ADMIN para confirmar este cambio privilegiado.')).toBeVisible();expect(api.table('UserRoles')).toHaveLength(1);await dialog.getByLabel('Escribe ADMIN para confirmar',{exact:true}).fill('ADMIN');await dialog.getByRole('button',{name:'Confirmar cambio de rol'}).click();await expect.poll(()=>api.table('UserRoles').length).toBe(2)
})
test('Admin JSON validation, flags and audit are real service workflows',async({page})=>{
 const api=await p4Api(page);await p3Login(page);await page.goto('/app/admin/settings?catalog=SystemConfigurations');await page.getByRole('button',{name:'Crear registro'}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Clave',{exact:true}).fill('real.setting');await dialog.getByLabel('Valor JSON',{exact:true}).fill('{bad}');await dialog.getByRole('button',{name:'Guardar cambios'}).click();await expect(dialog.getByText('Escribe JSON válido.')).toBeVisible();expect(api.table('SystemConfigurations')).toHaveLength(0);await dialog.getByLabel('Valor JSON',{exact:true}).fill('{"enabled":true}');await dialog.getByRole('button',{name:'Guardar cambios'}).click();await expect(dialog).not.toBeVisible()
 await page.getByLabel('Catálogo o configuración').selectOption('FeatureFlags');await page.getByRole('button',{name:'Crear registro'}).click();await dialog.getByLabel('Clave',{exact:true}).fill('flag.real');await dialog.getByLabel('Habilitado',{exact:true}).check();await dialog.getByRole('button',{name:'Guardar cambios'}).click();await expect(dialog).not.toBeVisible();expect(api.table('FeatureFlags')[0]?.enabled).toBe(true)
 await page.goto('/app/admin/audit');await expect(page.getByRole('cell',{name:'status',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'Cuenta P4',exact:true})).toBeVisible();await page.getByLabel('Acción',{exact:true}).selectOption('UPDATE');await expect(page.getByRole('row')).toHaveCount(2)
})
test('Empty catalogs, query failures and retry remain actionable',async({page})=>{
 const api=await p4Api(page,'ADMIN',{emptyCatalogs:true});api.table('AcademicPeriods').length=0;await p3Login(page);await expect(page.getByRole('link',{name:'Crear o seleccionar periodo académico'})).toBeVisible();await expect(page.getByRole('link',{name:'Configurar programas académicos'})).toBeVisible();api.failNext('PYRUnibague_Projects');await page.goto('/app/admin/projects');await expect(page.getByRole('button',{name:'Reintentar'})).toBeVisible();await page.getByRole('button',{name:'Reintentar'}).click();await expect(page.getByRole('link',{name:'Proyecto P4',exact:true})).toBeVisible();await page.getByLabel('Buscar',{exact:true}).fill('Sin resultados');await expect(page.getByRole('heading',{name:'Sin resultados'})).toBeVisible()
})
for(const width of [1440,768,320])test(`All admin routes are responsive, accessible, integrate matching and assignments at ${width}px`,async({page},testInfo)=>{
 await p4Api(page);await p3Login(page);await page.setViewportSize({width,height:800})
 for(const path of ['','students','organizations','projects','users','settings','audit','matching','assignments']){
  await page.goto('/app/admin/'+path);await expect(page.locator('#main h1')).toBeVisible();await expect(page.locator('.skeleton')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations,JSON.stringify(result.violations)).toEqual([]);if(['','projects','settings'].includes(path))await page.screenshot({path:testInfo.outputPath('admin-'+(path||'dashboard')+'-'+width+'.png'),fullPage:true})
 }
 await page.goto('/app/admin/matching');await expect(page.getByRole('heading',{name:'Matching',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Sin ejecuciones',exact:true})).toBeVisible();await expect(page.getByText('Motor de matching pendiente de integración P5')).toHaveCount(0);await page.goto('/app/admin/assignments');await expect(page.getByRole('heading',{name:'Asignaciones',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Optimizar y revisar'})).toBeVisible();await expect(page.getByText('Asignaciones pendientes de integración P6')).toHaveCount(0)
})
test('Catalog dialog keyboard Escape returns focus and guards unsaved edits',async({page})=>{
 await p4Api(page);await p3Login(page);await page.goto('/app/admin/settings');const button=page.getByRole('button',{name:'Crear registro'});await button.click();await expect(page.getByRole('dialog').getByLabel('Código',{exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(button).toBeFocused();await button.click();await page.getByRole('dialog').getByLabel('Código',{exact:true}).fill('Unsaved');page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Escape');await expect(button).toBeFocused()
})
test('P4 detail pages and administrative dialogs pass axe on mobile',async({page})=>{
 const api=await p4Api(page);await p3Login(page);await page.setViewportSize({width:320,height:800})
 for(const path of ['students/'+api.sid,'organizations/'+api.oid,'projects/'+api.projectId]){
  await page.goto('/app/admin/'+path);await expect(page.locator('#main h1')).toBeVisible();await expect(page.locator('.skeleton')).toHaveCount(0)
  if(path.startsWith('projects'))await page.getByText('Consultar o editar plaza y perfil requerido',{exact:true}).click()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
 }
 await page.goto('/app/admin/settings');await page.getByRole('button',{name:'Crear registro'}).click();expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);await page.keyboard.press('Escape')
 await page.goto('/app/admin/users');await page.getByRole('row').filter({hasText:'Estudiante P4'}).getByRole('button',{name:'Asignar ADMIN',exact:true}).click();expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
})
