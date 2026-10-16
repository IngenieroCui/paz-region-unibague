// Productive router, shell, auth and SDK with isolated HTTP. SQL tests verify invariants.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { p6bApi } from '../p6b/api.js'
import { p3Api, p3Login } from '../e2e/p3-api.js'
import { advisorApi, login } from '../advisors/api.js'

async function fixture(page: Page, role: 'ADMIN' | 'ORGANIZATION' = 'ADMIN') {
  const api = await p6bApi(page,role)
  const pool = { periodId:api.pid,revision:'p7',run:{id:'run',periodId:api.pid,status:'completed',threshold:70,configurationId:'config',snapshot:{}},
    students:[{id:api.sid,label:'Estudiante P4',periodId:api.pid,active:true,eligible:true},{id:'second',label:'Segundo estudiante',periodId:api.pid,active:true,eligible:true}],
    positions:[{id:'position',label:'Plaza P4',projectId:api.projectId,projectName:'Proyecto P4',organizationId:api.oid,organizationName:'Organización P4',periodId:api.pid,capacity:1,active:true,approved:true,validated:true},{id:'mechanical',label:'Plaza Mecánica',projectId:api.secondProject,projectName:'Proyecto Mecánica P6B',organizationId:api.oid,organizationName:'Organización P4',periodId:api.pid,capacity:1,active:true,approved:true,validated:true}],
    candidates:[[95,92],[94,72]].flatMap((scores,s) => scores.map((score,p) => ({id:`c${s}-${p}`,runId:'run',studentId:s ? 'second' : api.sid,positionId:p ? 'mechanical' : 'position',score,eligible:true,currentEligible:true,blockers:[]}))),existing:[] as {id:string;studentId:string;positionId:string;periodId:string;active:boolean}[] }
  const decisions: Record<string,unknown>[][] = []
  await page.route('https://pyr-e2e.example.test/**',async route => {
    const request = route.request(), name = new URL(request.url()).pathname.split('/').at(-1)
    if (name === 'pyr_unibague_project_institutional') return route.fulfill({json:{availability:'available',advisors:[{id:'advisor',displayName:'Asesor regional real'}],interlocutors:[{id:'contact',displayName:'Contacto operativo real'}],organizations:[{id:'partner',displayName:'Institución colaboradora'}]}})
    if (name === 'PYRUnibague_MatchingRuns') return route.fulfill({json:[{id:'run',academic_period_id:api.pid,status:'completed',created_at:'2026-10-13T12:00:00Z'}]})
    if (name === 'pyr_unibague_assignment_snapshot') { const body=request.postDataJSON();return route.fulfill({json:{...pool,run:body.p_run_id ? pool.run : null,candidates:body.p_run_id ? pool.candidates : []}}) }
    if (name === 'pyr_unibague_confirm_assignment_batch') {
      const actions=request.postDataJSON().p_actions as Record<string,unknown>[]; decisions.push(actions)
      api.table('Assignments').length=0
      for (const action of actions) {
        const id=crypto.randomUUID();pool.existing.push({id,studentId:String(action.student_id),positionId:String(action.position_id),periodId:api.pid,active:true})
        api.table('Assignments').push({id,student_id:action.student_id,project_position_id:action.position_id,academic_period_id:api.pid,status:'confirmed',is_active:true,source:'MATCHING',assigned_at:new Date().toISOString(),unassigned_at:null})
      }
      pool.revision='p7-after'
      return route.fulfill({json:pool.existing.map(a => ({assignment_id:a.id,integrations:{advisor:'missing_advisor',group:'selection_required'}}))})
    }
    return route.fallback()
  })
  return {...api,decisions}
}

test('productive organization navigation connects projects, calls, positions and teams',async ({page}) => {
  const api=await fixture(page,'ORGANIZATION');await p3Login(page)
  await page.getByRole('link',{name:'Convocatorias',exact:true}).click()
  await page.getByRole('link',{name:'Crear convocatoria',exact:true}).click()
  await page.getByLabel('Nombre de la convocatoria').fill('Convocatoria integrada')
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click()
  await page.getByRole('link',{name:'Vincular plazas',exact:true}).click()
  for (const position of ['position','mechanical']) { await page.getByLabel('Plaza existente').selectOption(position);await page.getByRole('button',{name:'Vincular plaza',exact:true}).click() }
  await expect(page.getByText(/Capacidad ofertada: 3 cupos/)).toBeVisible()
  await page.getByRole('button',{name:'Enviar para revisión',exact:true}).click();await page.getByRole('button',{name:'Confirmar estado'}).click()
  expect(api.table('Calls')[0]?.status).toBe('submitted')
  await page.getByRole('link',{name:'Equipos y estudiantes',exact:true}).click()
  await page.getByRole('link',{name:'Ver equipos',exact:true}).first().click()
  await expect(page.getByRole('heading',{name:'Estudiantes confirmados en el proyecto'})).toBeVisible()
  await expect(page.getByRole('region',{name:'Estudiantes confirmados',exact:true}).getByText('Estudiante P4')).toBeVisible()
})

test('productive ADMIN navigation runs global optimizer and opens advisor/team resolution',async ({page}) => {
  const api=await fixture(page);await p3Login(page)
  await page.getByRole('link',{name:'Asignaciones',exact:true}).click()
  await page.getByLabel('Ejecución completada').selectOption('run')
  await page.getByRole('button',{name:'Optimizar y revisar',exact:true}).click();await page.getByRole('button',{name:'Calcular propuesta',exact:true}).click()
  await expect(page.getByText(/compatibilidad total 186.00/)).toBeVisible();expect(api.decisions).toHaveLength(0)
  await page.getByRole('button',{name:'Revisar y confirmar lote (2)'}).click()
  const confirm=page.getByRole('dialog').getByRole('button',{name:'Confirmar decisión',exact:true});await confirm.focus();await page.keyboard.press('Enter')
  await expect(page.getByText(/Falta vincular asesor individual/)).toBeVisible();expect(api.decisions).toHaveLength(1)
  await expect(page.getByRole('link',{name:'Revisar asesor individual',exact:true})).toHaveAttribute('href','/app/admin/advisors')
  await page.getByRole('link',{name:'Vincular equipo del proyecto',exact:true}).click()
  await expect(page.getByRole('link',{name:'Ver equipos',exact:true}).first()).toBeVisible()
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
})

test('student sees confirmed destination, individual advisor and only teammate projection',async ({page}) => {
  await p3Api(page,'STUDENT')
  await page.route('**/rest/v1/rpc/pyr_unibague_student_assignment',route => route.fulfill({json:{id:'assignment',organization:'Institución confirmada',project:'Proyecto confirmado',position:'Perfil confirmado',advisor:'Asesor individual',group:'Equipo confirmado',teammates:[{id:'membership',name:'Compañero confirmado'}]}}))
  await p3Login(page)
  await expect(page.getByRole('heading',{name:'Mi asignación confirmada'})).toBeVisible()
  for (const name of ['Institución confirmada','Proyecto confirmado','Perfil confirmado','Equipo confirmado']) await expect(page.getByText(name,{exact:true})).toBeVisible()
  await expect(page.getByText(/Compañero confirmado/)).toBeVisible()
  await page.getByRole('link',{name:'Mi asignación',exact:true}).click()
  await page.reload()
  await expect(page.getByText('Confirmada',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Calcular propuesta'})).toHaveCount(0)
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
  const forbidden:string[]=[];page.on('request',r => { if(r.url().includes('assignment_snapshot')) forbidden.push(r.url()) })
  await page.goto('/app/admin/assignments');await expect(page).toHaveURL(/unauthorized/);expect(forbidden).toEqual([])
})

for (const width of [320,390,768,1440]) test(`integrated institutional sheet, printing and axe at ${width}px`,async ({page},testInfo) => {
  const api=await fixture(page);await p3Login(page);await page.setViewportSize({width,height:900})
  await page.goto('/app/admin/projects/'+api.projectId)
  const sheet=page.getByRole('region',{name:'Ficha institucional del proyecto'})
  for(const name of ['Asesor regional real','Contacto operativo real','Institución colaboradora']) await expect(sheet.getByText(name,{exact:true})).toBeVisible()
  await expect(page.getByLabel('Interlocutor operativo',{exact:true})).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
  await page.screenshot({path:testInfo.outputPath('integrated-sheet-'+width+'.png'),fullPage:true})
  await page.emulateMedia({media:'print'});await expect(sheet).toBeVisible();await expect(page.getByRole('button',{name:'Imprimir ficha'})).not.toBeVisible();await expect(page.getByLabel('Nombre del proyecto')).not.toBeVisible()
})

test('persisted ADVISOR is denied the administrative assignment route before data reads',async ({page}) => {
  await advisorApi(page,['ADVISOR']);await login(page)
  const requests:string[]=[];page.on('request',r => {if(r.url().includes('assignment_snapshot'))requests.push(r.url())})
  await page.goto('/app/admin/assignments');await expect(page).toHaveURL(/unauthorized/);expect(requests).toEqual([])
})

const summary = { pendingOrganizations: 2, pendingProjects: 1, unassignedEligible: 3, vacantPositions: 2, vacantCapacity: 4, organizationsWithoutAdvisor: 1, assignmentsWithoutAdvisor: 1, assignmentsRequiringReview: 2 }
test('ADMIN exports allowlisted CSV, changes period and follows operational indicators', async ({page}) => {
  const api = await fixture(page)
  const other = '14000000-0000-0000-0000-000000000002'
  api.table('AcademicPeriods').push({ ...api.table('AcademicPeriods')[0], id: other, name: 'Otro periodo operativo', is_current: false })
  const periods: string[] = []
  await page.route('**/rest/v1/rpc/pyr_unibague_operational_summary', route => {
    const period = route.request().postDataJSON().p_period_id; periods.push(period)
    return route.fulfill({ json: period === other ? { ...summary, vacantCapacity: 9 } : summary })
  })
  await page.route('**/rest/v1/rpc/pyr_unibague_operational_export', route => {
    const body = route.request().postDataJSON()
    expect(body.p_period_id).toBe(other)
    return route.fulfill({ json: body.p_kind === 'assignments' ? [{ id: 'a', student: '=HYPERLINK("https://example.test")', organization: 'Institución Á', project: 'Proyecto real', position: 'Sistemas', program: 'Ingeniería', advisor: 'Asesor', group: 'Equipo', status: 'confirmed', is_active: true, notes: 'PRIVATE' }] : [{ id: 'p', organization: 'Institución Á', project: 'Proyecto real', position: 'Sistemas', capacity: 2, occupied: 1, is_active: true, project_status: 'approved' }] })
  })
  await p3Login(page); await page.getByRole('link',{name:'Pendientes y CSV',exact:true}).click()
  await expect(page.getByText(/Cupos disponibles.*: 4/)).toBeVisible()
  await page.getByLabel('Periodo operativo').selectOption(other)
  await expect(page.getByText(/Cupos disponibles.*: 9/)).toBeVisible()
  for (const name of ['Exportar asignaciones', 'Exportar plazas y ocupación']) {
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button',{name,exact:true}).click()
    const download = await downloadPromise, path = await download.path()
    expect(download.suggestedFilename()).toContain(other)
    const bytes = await readFile(path!)
    expect([...bytes.subarray(0,3)]).toEqual([239,187,191])
    expect(bytes.toString()).not.toContain('PRIVATE')
    if (name === 'Exportar asignaciones') expect(bytes.toString()).toContain('"\'=HYPERLINK')
    else expect(bytes.toString()).toContain('"2";"1"')
  }
  expect(periods).toContain(other)
  await page.getByRole('link',{name:'Abrir módulo · elegibles sin asignación',exact:true}).click()
  await expect(page.getByLabel('Periodo académico',{exact:true})).toHaveValue(other)
})

test('operational panel ignores an obsolete period response', async ({page}) => {
  const api = await fixture(page), other = '14000000-0000-0000-0000-000000000002'
  api.table('AcademicPeriods').push({ ...api.table('AcademicPeriods')[0], id: other, name: 'Otro periodo operativo', is_current: false })
  let release: () => void = () => {}, started: () => void = () => {}
  const firstStarted = new Promise<void>(resolve => { started = resolve })
  const blocked = new Promise<void>(resolve => { release = resolve })
  await page.route('**/rest/v1/rpc/pyr_unibague_operational_summary', async route => {
    const old = route.request().postDataJSON().p_period_id === api.pid
    if (old) { started(); await blocked }
    await route.fulfill({json:{...summary,vacantCapacity:old ? 4 : 9}})
  })
  await p3Login(page); await page.goto('/app/admin/operations'); await firstStarted
  await page.getByLabel('Periodo operativo').selectOption(other)
  await expect(page.getByText(/Cupos disponibles.*: 9/)).toBeVisible()
  release(); await expect(page.getByText(/Cupos disponibles.*: 4/)).toHaveCount(0)
})

test('student notification inbox marks only own message read and follows a real destination', async ({page}) => {
  const api = await p3Api(page,'STUDENT')
  let read = false
  await page.route('**/rest/v1/PYRUnibague_Notifications*', route => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('user_id')).toBe('eq.'+api.uid)
    const rows = read && url.searchParams.has('read_at') ? [] : [{ id:'note',user_id:api.uid,title:'Asignación confirmada',body:'Consulta el destino confirmado.',type_code:'ASSIGNMENT_ASSIGNED',link_path:'/app/student/assignment',read_at:read ? '2026-10-13T18:00:00Z' : null,created_at:'2026-10-13T18:00:00Z' }]
    return route.fulfill({json:rows,headers:{'content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`,'access-control-expose-headers':'content-range'}})
  })
  await page.route('**/rest/v1/rpc/pyr_unibague_mark_notification_read', route => { expect(route.request().postDataJSON()).toEqual({notification_id:'note'});read=true;return route.fulfill({json:true}) })
  await p3Login(page); await page.getByRole('link',{name:'Notificaciones',exact:true}).click()
  await expect(page.getByText(/Sin leer ·/)).toBeVisible()
  await page.getByRole('button',{name:'Marcar como leída',exact:true}).focus(); await page.keyboard.press('Enter')
  await expect(page.getByText('Notificación marcada como leída.',{exact:true})).toBeFocused()
  await expect(page.getByText(/^Leída ·/)).toBeVisible()
  await page.getByLabel('Solo sin leer').check(); await expect(page.getByRole('heading',{name:'Sin resultados',exact:true})).toBeVisible()
  await page.getByLabel('Solo sin leer').uncheck(); await page.getByRole('link',{name:'Consultar recurso',exact:true}).click()
  await expect(page).toHaveURL(/\/app\/student\/assignment$/)
  await page.goto('/app/admin/operations'); await expect(page).toHaveURL(/unauthorized/)
})

test('advisor project teams are read-only and use the scoped projection', async ({page}) => {
  await advisorApi(page,['ADVISOR'])
  await page.route('**/rest/v1/rpc/pyr_unibague_advisor_project_team', route => route.fulfill({json:{groups:[],members:[],assignments:[{id:'own',student_id:'student',display_name:'Estudiante bajo mi asesoría',program_name:'Sistemas',position_title:'Desarrollo',is_active:true,status:'confirmed',unassigned_at:null}]}}))
  await login(page); await page.getByRole('link',{name:'Proyectos asociados',exact:true}).click()
  await page.getByText('Consultar equipos del proyecto',{exact:true}).click()
  await expect(page.getByText(/Estudiante bajo mi asesoría · Sistemas · Desarrollo/)).toBeVisible()
  await expect(page.getByRole('button',{name:'Guardar equipo',exact:true})).toHaveCount(0)
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([])
})

for (const width of [320,390,768]) test(`operations and notifications fit ${width}px with axe`, async ({page}, testInfo) => {
  const api = await fixture(page)
  await page.route('**/rest/v1/rpc/pyr_unibague_operational_summary', route => route.fulfill({json:summary}))
  await page.route('**/rest/v1/PYRUnibague_Notifications*', route => route.fulfill({json:[],headers:{'content-range':'0-0/0','access-control-expose-headers':'content-range'}}))
  await p3Login(page); await page.setViewportSize({width,height:900})
  for (const path of ['/app/admin/operations?period='+api.pid,'/app/admin/notifications']) {
    await page.goto(path)
    await expect(page.getByRole('heading',{level:1})).toBeVisible()
    if (path.includes('operations')) await expect(page.getByText(/Cupos disponibles.*: 4/)).toBeVisible()
    else await expect(page.getByRole('heading',{name:'Sin resultados',exact:true})).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    await page.screenshot({path:testInfo.outputPath((path.includes('operations') ? 'operations-' : 'notifications-')+width+'.png'),fullPage:true})
  }
})
