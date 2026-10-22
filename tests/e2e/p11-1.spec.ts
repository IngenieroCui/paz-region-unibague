import { expect, test } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { p3Api, p3Login } from './p3-api.js'
import { mkdir, writeFile } from 'node:fs/promises'
for(const width of [320,390,768,1024,1440]) test(`P11.1 student dashboard, progress and keyboard at ${width}px`,async({page})=>{
 const api=await p3Api(page,'STUDENT');api.tables.PYRUnibague_AcademicPeriods=[]
 api.table('StudentPeriodParticipations').push({id:'historical',student_id:api.sid,academic_period_id:'old-period',status:'completed',eligible_for_matching:false})
 await page.setViewportSize({width,height:1000});await p3Login(page)
 await expect(page.getByRole('heading',{name:'Mi experiencia en Paz y Región'})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Sin periodo actual'})).toBeVisible()
 await expect(page.locator('.student-next-actions > li')).toHaveCount(3)
 await page.getByText('Participaciones anteriores (2)',{exact:true}).click()
 await expect(page.getByRole('link',{name:'Consultar asignación histórica'})).toHaveCount(2)
 expect(api.calls.some(c=>/Municipalities|StudentExperiences|^.*\/PYRUnibague_Skills$/.test(c.path))).toBe(false)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
 const skip=page.getByRole('link',{name:'Saltar al contenido',exact:true});await skip.focus();await page.keyboard.press('Enter');await expect(page.locator('#main')).toBeFocused()
 await mkdir('work/p11-1/screens',{recursive:true});await page.screenshot({path:`work/p11-1/screens/student-${width}.png`,fullPage:true})
})
test('P11.1 nontechnical program saves without professional links and reuses municipality catalog',async({page})=>{
 const api=await p3Api(page,'STUDENT');api.table('AcademicPrograms')[0]!.name='Derecho'
 await p3Login(page);await page.goto('/app/student/profile')
 await page.getByLabel('Bio',{exact:true}).fill('')
 await page.getByLabel('Qué trabajo te gustaría desarrollar',{exact:true}).fill('')
 await expect(page.getByLabel('GitHub · Opcional')).toBeHidden()
 await page.getByRole('button',{name:'Guardar cambios',exact:true}).click()
 await expect(page.getByText('Cambios guardados',{exact:true})).toBeVisible()
 expect(api.table('Students')[0]!.profile_links).toEqual({})
 expect(api.table('Students')[0]!.bio).toBeNull()
 const count=api.calls.filter(c=>c.path.endsWith('/PYRUnibague_Municipalities')).length
 await page.getByRole('link',{name:'Preferencias',exact:true}).click()
 await expect(page.getByLabel('Municipio preferido')).toBeVisible()
 expect(api.calls.filter(c=>c.path.endsWith('/PYRUnibague_Municipalities'))).toHaveLength(count)
})
test('P11.1 current period, documents and slow section load remain scoped',async({page})=>{
 const api=await p3Api(page,'STUDENT');await p3Login(page)
 await expect(page.getByRole('heading',{name:'Periodo de prueba',exact:true})).toBeVisible()
 await page.route('**/PYRUnibague_StudentDocuments*',async route=>{await new Promise(resolve=>setTimeout(resolve,400));await route.fallback()})
 const start=api.calls.length
 await page.getByRole('link',{name:'Documentos',exact:true}).click()
 await expect(page.getByRole('button',{name:'Subir documento',exact:true})).toBeVisible()
 expect(api.calls.slice(start).filter(c=>c.path.endsWith('/PYRUnibague_Municipalities'))).toHaveLength(0)
})
test('P11.1 wrong portal and multirole selection never assign roles',async({page})=>{
 const api=await p3Api(page,'STUDENT')
 await page.route('**/pyr_unibague_current_roles',route=>route.fulfill({json:['STUDENT','ORGANIZATION']}))
 await p3Login(page);await expect(page).toHaveURL(/\/select-role$/)
 await page.getByRole('link',{name:/Estudiante/}).click();await expect(page).toHaveURL(/\/app\/student$/)
 await page.goto('/app/admin');await expect(page).toHaveURL(/\/unauthorized$/)
 expect(api.calls.some(c=>/UserRoles$/.test(c.path)&&c.method!=='GET')).toBe(false)
})
test('P11.1 organization home shows recent reviews and links to the complete history',async({page})=>{
 const api=await p3Api(page,'ORGANIZATION')
 for(let i=0;i<4;i++) api.table('OrganizationReviews').push({id:'extra-'+i,organization_id:api.oid,decision:'changes_requested',notes:'Observación '+i,created_at:'2026-10-01T12:00:00Z'})
 await p3Login(page);await expect(page.locator('.review-timeline > li')).toHaveCount(3)
 await page.getByRole('link',{name:'Consultar historial completo (5)'}).click()
 await expect(page.locator('.review-timeline > li')).toHaveCount(5)
})
test('P11.1 isolated request benchmark saves request counts and equivalent latency conditions',async({page})=>{
 const api=await p3Api(page,'STUDENT');await p3Login(page)
 const rows=[]
 for(const [section,heading] of [['documents','Documentos'],['profile','Mi perfil'],['experience','Experiencia'],['preferences','Preferencias territoriales']] as const){
  const start=api.calls.length,time=performance.now();await page.goto('/app/student/'+section)
  await expect(page.getByRole('heading',{level:1,name:heading,exact:true})).toBeVisible()
  await page.waitForLoadState('networkidle')
  rows.push({section,ms:Math.round(performance.now()-time),requests:api.calls.slice(start).map(c=>c.path.split('/').at(-1))})
 }
 await mkdir('work/p11-1',{recursive:true});await writeFile('work/p11-1/isolated-requests.json',JSON.stringify(rows,null,2))
})
