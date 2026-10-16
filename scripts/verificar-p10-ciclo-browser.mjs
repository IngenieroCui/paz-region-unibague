import { chromium, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { ledger, login, check, save } from './p10-context.mjs'
const f=JSON.parse(await readFile('work/p10/fixtures.json','utf8'))
const admin=ledger.accounts.find(a=>a.role==='ADMIN'),api=await login(admin),report=[]
const base=process.env.PYR_TEST_BASE_URL||'http://localhost:5173'
const browser=await chromium.launch({channel:'msedge',headless:true}),ctx=await browser.newContext(),page=await ctx.newPage()
const student=f.students[2].id,name=ledger.accounts.filter(a=>a.role==='STUDENT')[2].display_name
async function active(){return check(await api.from('PYRUnibague_Assignments').select('*').eq('student_id',student).eq('academic_period_id',f.period.id).eq('is_active',true),'Asignación E3')}
async function settle(){await page.waitForLoadState('networkidle');await expect(page.getByRole('heading',{level:1})).toBeVisible()}
async function confirm(){await page.getByRole('dialog').getByRole('button',{name:'Confirmar decisión',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByText('Decisión confirmada. Cupos e historial actualizados.',{exact:false})).toBeVisible()}
try {
 await page.goto(base+'/login');await expect(page.getByText(/Demostración controlada/)).toBeVisible()
 await page.getByLabel('Correo electrónico',{exact:true}).fill(admin.email);await page.getByLabel('Contraseña',{exact:true}).fill(admin.password);await page.getByRole('button',{name:'Ingresar',exact:true}).click();await page.waitForURL(base+'/app/admin')
 await page.goto(base+'/app/admin/matching');await settle();await page.getByRole('button',{name:'Ejecutar',exact:true}).click()
 await page.getByLabel('Configuración para ejecutar',{exact:true}).selectOption(f.matchingConfig.id)
 await page.getByRole('button',{name:'Revisar y ejecutar',exact:true}).click()
 const response=page.waitForResponse(r=>r.url().includes('/functions/v1/matching-run')&&r.request().method()==='POST')
 await page.getByRole('dialog').getByRole('button',{name:'Ejecutar compatibilidad',exact:true}).click()
 const edge=await response;expect(edge.status()).toBe(200);const result=await edge.json();await expect(page.getByRole('dialog')).toHaveCount(0)
 report.push({label:'Matching desde navegador, CORS localhost autorizado, Edge y candidatos reales',status:'PASS',run_id:result.run_id})
 await page.goto(base+'/app/admin/assignments?period='+f.period.id);await settle()
 await page.getByRole('button',{name:'Optimizar y revisar',exact:true}).click();await page.getByLabel('Ejecución completada',{exact:true}).selectOption(result.run_id)
 await page.getByRole('button',{name:'Calcular propuesta',exact:true}).click()
 const confirmStudent=page.getByRole('button',{name:'Confirmar '+name,exact:true});await expect(confirmStudent).toBeVisible({timeout:20000});await confirmStudent.click();await confirm()
 const first=(await active())[0];expect(first).toBeTruthy();report.push({label:'Confirmación de propuesta E3 desde UI y persistencia real',status:'PASS'})
 await page.getByRole('button',{name:'Intervención manual',exact:true}).click()
 await page.getByLabel('Estudiante a intervenir',{exact:true}).selectOption(student)
 const destination=f.positions.find(p=>p.id!==first.project_position_id&&p.title.includes('Sistemas'))
 await page.getByLabel('Destino manual',{exact:true}).selectOption(destination.id)
 await page.getByLabel('Motivo de intervención',{exact:true}).selectOption('COORDINATION_REQUEST');await page.getByLabel('Justificación',{exact:true}).fill('TEST P10 · Reasignación de demostración, exclusivamente E3.')
 await page.getByRole('button',{name:'Revisar reasignación',exact:true}).click();await confirm()
 expect((await active())[0].project_position_id).toBe(destination.id);report.push({label:'Reasignación manual real desde UI conserva historial',status:'PASS'})
 await page.getByLabel('Estudiante a intervenir',{exact:true}).selectOption(student)
 await page.getByLabel('Motivo de intervención',{exact:true}).selectOption('COORDINATION_REQUEST');await page.getByLabel('Justificación',{exact:true}).fill('TEST P10 · Restaurar escenario elegible sin asignación.')
 await page.getByRole('button',{name:'Revisar retiro',exact:true}).click();await confirm();expect(await active()).toHaveLength(0)
 report.push({label:'Desasignación real desde UI, E3 queda sin destino vigente',status:'PASS'})
 const history=check(await api.from('PYRUnibague_Assignments').select('id').eq('student_id',student).eq('academic_period_id',f.period.id),'Historial E3')
 const events=check(await api.from('PYRUnibague_AssignmentEvents').select('event_type').in('assignment_id',history.map(a=>a.id)),'Eventos históricos')
 for(const type of ['ASSIGNED','REASSIGNED_FROM','REASSIGNED_TO','UNASSIGNED'])expect(events.some(e=>e.event_type===type)).toBe(true)
 report.push({label:'Eventos reales de asignación, reasignación y desasignación persistidos',status:'PASS'})
 console.log('PASS ciclo completo ADMIN UI → Edge/RPC → base persistida → UI')
}catch(e){report.push({status:'FAIL',error:e.message});throw e}
finally {
 const rows=await active()
 if(rows.length){const state=check(await api.rpc('pyr_unibague_assignment_snapshot',{p_period_id:f.period.id,p_run_id:null}),'Snapshot restauración');check(await api.rpc('pyr_unibague_unassign_assignment',{p_period_id:f.period.id,p_run_id:null,p_revision:state.revision,p_action:{student_id:student,assignment_id:rows[0].id,reason_code:'COORDINATION_REQUEST',reason_text:'TEST P10 · Restauración final E3.'}}),'Restauración E3')}
 check(await api.rpc('pyr_unibague_change_student_advisor',{p_participation_id:f.participations[2].id,p_advisor_id:f.staff[1].id}),'Restauración asesor E3')
 await save('lifecycle-browser-results.json',report);await api.auth.signOut({scope:'local'});await browser.close()
}
