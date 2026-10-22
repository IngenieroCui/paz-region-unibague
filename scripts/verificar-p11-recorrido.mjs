// Real browser + Supabase. TEST organization only, no traces or mail.
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { publicClient, check, ref } from './supabase-admin.mjs'
const ledger = JSON.parse(await readFile('work/p11/cuentas-test.local.json','utf8'))
const fixtures = JSON.parse(await readFile('work/p11/fixtures.local.json','utf8'))
if (ledger.project_ref !== ref || fixtures.project_ref !== ref) throw Error('Proyecto inesperado')
const account = ledger.accounts.filter(a=>a.role==='ORGANIZATION')[1]
const organization = fixtures.organizations.find(o=>o.user_id===account.user_id)
if (!organization) throw Error('Falta fixture TEST propia')
const id = organization.id, results = []
const runId = new Date().toISOString()
const api = await publicClient()
check(await api.auth.signInWithPassword({email:account.email,password:account.password}),'Login TEST')
const browser = await chromium.launch({channel:'msedge',headless:true})
const ctx = await browser.newContext({viewport:{width:390,height:960}})
const adminCtx = await browser.newContext({viewport:{width:1440,height:960}})
const page = await ctx.newPage(), adminPage = await adminCtx.newPage()
const base = process.env.PYR_TEST_BASE_URL
const pass = label => {results.push({label,status:'PASS'});console.log('PASS',label)}
async function login(p,a) {
  await p.goto(base+(a.role==='ORGANIZATION'?'/login/organizaciones':'/login/institucional'))
  await p.getByLabel('Correo electrónico',{exact:true}).fill(a.email)
  await p.getByLabel('Contraseña',{exact:true}).fill(a.password)
  await p.getByRole('button',{name:'Ingresar',exact:true}).click()
  await p.waitForURL(/\/app\//)
}
try {
  await login(page,account)
  await page.goto(base+'/app/organization/profile?organization='+id)
  await expect(page.getByLabel('Nombre legal')).toHaveValue('TEST P11 Organización 2')
  await page.getByLabel('Descripción',{exact:true}).fill('TEST P11 · Corrección guardada desde navegador móvil')
  await page.getByRole('button',{name:'Guardar organización',exact:true}).click()
  await expect(page.getByText('Cambios guardados',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Editar Responsable TEST P11',exact:true}).click()
  await page.getByLabel('Cargo',{exact:true}).fill('TEST P11 · Responsable de registro')
  await page.getByRole('button',{name:'Revisar cambios del interlocutor'}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Guardar interlocutor'}).click()
  await expect(page.getByText(/TEST P11 · Responsable de registro/)).toBeVisible()
  pass('Perfil y contacto guardados desde UI móvil contra Supabase real')
  await page.goto(base+'/app/organization/documents?organization='+id)
  const docs=check(await api.from('PYRUnibague_OrganizationDocuments').select('id').eq('organization_id',id).eq('category_code','TEST-P11-BROWSER'),'Documentos TEST')
  if(!docs.length) {
    await page.getByLabel('Categoría',{exact:true}).fill('TEST-P11-BROWSER')
    await page.getByLabel('Archivo',{exact:true}).setInputFiles('tests/fixtures/TEST-CV.pdf')
    await page.getByRole('button',{name:'Subir documento',exact:true}).click()
    await expect(page.getByText('Documento guardado',{exact:true})).toBeVisible()
  }
  await expect(page.getByRole('heading',{name:'TEST-CV.pdf',exact:true})).toBeVisible()
  pass('Documento privado subido desde navegador contra Storage real')
  await login(adminPage,ledger.accounts.find(a=>a.role==='ADMIN'))
  await adminPage.goto(base+'/app/admin/organizations/'+id)
  await expect(adminPage.getByRole('heading',{name:'Responsable TEST P11 · Principal',exact:true})).toBeVisible()
  for(const [decision,message] of [['changes_required','TEST P11 navegador: corregir descripción'],['approved','TEST P11 navegador: aprobación independiente']]) {
    const notes = message + ' · ' + runId
    await adminPage.getByLabel('Decisión',{exact:true}).selectOption(decision)
    await adminPage.getByLabel('Observaciones',{exact:true}).fill(notes)
    await adminPage.getByRole('button',{name:'Revisar decisión',exact:true}).click()
    await adminPage.getByRole('dialog').getByRole('button',{name:'Publicar decisión',exact:true}).click()
    await expect(adminPage.getByRole('dialog')).toHaveCount(0)
    await expect(adminPage.getByRole('cell',{name:notes,exact:true})).toBeVisible()
    await page.goto(base+'/app/organization/reviews?organization='+id)
    await expect(page.getByText(notes,{exact:true})).toBeVisible()
    if(decision==='changes_required') {
      await expect(page.getByRole('button',{name:'Reenviar solicitud corregida',exact:true})).toBeDisabled()
      results.push({label:'Envío formal P11 desde navegador',status:'SKIPPED',reason:'La UI informa RPC pendiente; no se simula envío.'})
      await page.goto(base+'/app/organization/profile?organization='+id)
      await page.getByLabel('Descripción',{exact:true}).fill('TEST P11 · Descripción corregida tras observación ADMIN')
      await page.getByRole('button',{name:'Guardar organización',exact:true}).click()
      await expect(page.getByText('Cambios guardados',{exact:true})).toBeVisible()
    }
  }
  pass('ADMIN solicita corrección y aprueba; organización consulta ambas decisiones reales')
  await expect(page.getByRole('definition').filter({hasText:/^Aprobado$/})).toBeVisible()
  for(const width of [320,390,768,1440]) {await page.setViewportSize({width,height:960});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
  await page.screenshot({path:'work/p11/browser/screens/review-approved-real.png',fullPage:true})
  pass('Estado aprobado y recorrido adaptables en 320/390/768/1440')
} catch(error) {results.push({label:'Recorrido UI real',status:'FAIL',error:error.message});console.error(error.message);process.exitCode=1}
finally {
  await api.auth.signOut();await browser.close()
  await writeFile('docs/p11/real-browser-journey.json',JSON.stringify({checked_at:new Date().toISOString(),project:ref,mode:'real browser/Auth/Data/Storage',results},null,2)+'\n')
}
