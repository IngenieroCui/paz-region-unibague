// Browser con Auth, PostgREST y Storage hospedados. Sin mocks, traces ni HAR.
import { chromium, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { ledger } from './p10-context.mjs'
const f=JSON.parse(await readFile('work/p10/fixtures.json','utf8'))
const base=process.env.PYR_TEST_BASE_URL||'http://127.0.0.1:5273'
const out='work/p10/screens',report=[]
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const paths={STUDENT:'student',ADVISOR:'advisor',ORGANIZATION:'organization',ADMIN:'admin'}
async function settle(page) {
 await page.waitForLoadState('networkidle')
 await expect(page.getByRole('heading',{level:1})).toBeVisible({timeout:20000})
 await page.evaluate(()=>document.fonts.ready)
 await expect(page.getByText('No tienes permiso para esta operación.',{exact:true})).toHaveCount(0)
 await expect(page.getByText('No pudimos cargar la información',{exact:true})).toHaveCount(0)
}
async function responsive(page,label) {
 for(const width of [320,390,768,1440]) {
  await page.setViewportSize({width,height:960})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow '+width).toBe(true)
 }
}
async function audit(page,label) {
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations
 expect(violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),label).toEqual([])
}
try {
 const pub=await browser.newContext(),p=await pub.newPage()
 for(const route of ['/','/login']) {await p.goto(base+route);await settle(p);await responsive(p,route);await audit(p,route);await p.screenshot({path:out+(route==='/'?'/home.png':'/login.png'),fullPage:true})}
 await pub.close()
 const counters={}
 for(const account of ledger.accounts) {
  const role=account.role,index=counters[role]??0;counters[role]=index+1
  const ctx=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true}),page=await ctx.newPage(),errors=[],apiErrors=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('response',r=>{if(r.url().includes('.supabase.co/')&&r.status()>=400)apiErrors.push({path:new URL(r.url()).pathname,status:r.status()})})
  await page.goto(base+'/login');await page.getByLabel('Correo electrónico',{exact:true}).fill(account.email);await page.getByLabel('Contraseña',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Ingresar',exact:true}).click()
  const space='/app/'+paths[role]
  await page.waitForURL(base+space,{timeout:25000});await settle(page)
  await page.screenshot({path:out+'/'+paths[role]+(index?'-'+(index+1):'')+'-dashboard.png',fullPage:true})
  await responsive(page,role)
  if(!index) {
   await audit(page,role)
   await page.setViewportSize({width:390,height:960});await page.screenshot({path:out+'/'+paths[role]+'-mobile.png',fullPage:true})
   await page.getByRole('button',{name:'Abrir navegación'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Abrir navegación'})).toBeFocused();await page.setViewportSize({width:1440,height:960})
  }
  const links=await page.locator('.desktop-sidebar nav a').evaluateAll(a=>a.map(el=>el.getAttribute('href')))
  for(const route of [...links,space+'/notifications']) {
   await page.goto(base+route);await settle(page)
   if(!index){await responsive(page,route);await audit(page,route)}
   report.push({scope:role,index:index+1,route,status:'PASS'})
  }
  if(role==='STUDENT') {
   await page.goto(base+space);await settle(page)
   await expect(page.getByText(index<3?'Habilitada':'No habilitada',{exact:false})).toBeVisible()
   if(index<2){await expect(page.getByText(f.groups[0].name,{exact:true})).toBeVisible();await expect(page.getByText(ledger.accounts.filter(a=>a.role==='STUDENT')[index?0:1].display_name,{exact:false})).toBeVisible()}
   else await expect(page.getByText('Aún no tienes una asignación confirmada en este periodo.')).toBeVisible()
   await page.goto(base+space+'/documents');await settle(page);await expect(page.getByText('TEST-P10-CV.pdf',{exact:true})).toBeVisible()
  }
  if(role==='ORGANIZATION') {
   await page.goto(base+space+'/projects/'+f.projects[index].id);await settle(page)
   await expect(page.getByRole('heading',{name:'Ficha institucional del proyecto'})).toBeVisible()
   if(!index)await expect(page.getByText(/Capacidad ofertada activa: 3\. Capacidad total registrada: 6\./)).toBeVisible()
   await expect(page.getByText('TEST P10 Interlocutor '+(index+1),{exact:true})).toBeVisible()
   if(index) {await expect(page.getByRole('region',{name:'Historial de integrantes retirados'})).toBeVisible();await expect(page.getByRole('region',{name:'Integrantes vigentes de '+f.groups[1].name}).getByText(/Pyrprueba Estudiante 3/)).toHaveCount(0)}
   await page.emulateMedia({media:'print'});await expect(page.getByRole('button',{name:'Imprimir ficha'})).toBeHidden()
   await page.pdf({path:out+'/ficha-'+(index+1)+'.pdf',format:'A4',printBackground:true})
   await page.screenshot({path:out+'/ficha-'+(index+1)+'.png',fullPage:true});await page.emulateMedia({media:'screen'})
  }
  if(role==='ADVISOR') {
   await page.goto(base+space+'/students');await settle(page)
   await expect(page.getByRole('heading',{name:ledger.accounts.filter(a=>a.role==='STUDENT')[index].display_name,exact:true})).toBeVisible()
   await expect(page.getByRole('heading',{name:ledger.accounts.filter(a=>a.role==='STUDENT')[index?0:1].display_name,exact:true})).toHaveCount(0)
  }
  if(role==='ADMIN') {
   await page.goto(base+space+'/matching');await settle(page);await page.screenshot({path:out+'/matching.png',fullPage:true})
   await page.goto(base+space+'/assignments?period='+f.period.id);await settle(page)
   await page.getByRole('button',{name:'Optimizar y revisar',exact:true}).click()
   await page.getByLabel('Ejecución completada',{exact:true}).selectOption(f.runId)
   await page.getByRole('button',{name:'Calcular propuesta',exact:true}).click()
   await expect(page.getByRole('heading',{name:'Propuesta global'})).toBeVisible({timeout:20000})
   await responsive(page,'Optimización poblada');await audit(page,'Optimización poblada');await page.screenshot({path:out+'/assignments.png',fullPage:true})
   await page.goto(base+space+'/operations?period='+f.period.id);await settle(page)
   const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar asignaciones',exact:true}).click();const download=await wait;await download.saveAs('work/p10/asignaciones.csv')
   const csv=await readFile('work/p10/asignaciones.csv','utf8');expect(csv).toContain('Pyrprueba Estudiante');expect(csv).toContain('TEST P10')
  }
  await page.goto(base+space);await settle(page);await page.reload();await settle(page)
  for(const other of Object.keys(paths).filter(r=>r!==role)){await page.goto(base+'/app/'+paths[other]);await page.waitForURL(base+'/unauthorized')}
  await page.goto(base+space);await settle(page);await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.waitForURL(base+'/login')
  expect(errors,'Errores JS '+role).toEqual([]);expect(apiErrors,'Errores API inesperados '+role).toEqual([])
  report.push({account:account.user_id,role,status:'PASS',login:true,reload:true,guards:true,logout:true})
  await ctx.close();console.log('PASS browser',role,index+1)
 }
}catch(e){report.push({status:'FAIL',error:e.message});throw e}
finally{await writeFile('work/p10/browser-results.json',JSON.stringify(report,null,2));await browser.close()}
