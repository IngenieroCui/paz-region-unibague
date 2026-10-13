// Productive router, shell, auth and SDK with isolated HTTP. SQL tests verify invariants.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
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
  for (const name of ['Institución confirmada','Proyecto confirmado','Perfil confirmado','Equipo confirmado','Compañero confirmado']) await expect(page.getByText(name,{exact:true})).toBeVisible()
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
