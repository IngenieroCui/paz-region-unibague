import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { p4Api } from '../e2e/p4-api.js'
import { mkdir } from 'node:fs/promises'

async function fixture(page: Page, role: 'ADMIN'|'ORGANIZATION' = 'ORGANIZATION', options: { enrolled?: boolean; autoConfirm?: boolean; serverReady?: boolean } = {}) {
  const api = await p4Api(page, role)
  let enrolled = options.enrolled ?? true
  const signupBodies: Record<string,unknown>[] = []
  await page.route('https://challenges.cloudflare.com/turnstile/**', route => route.fulfill({ contentType:'application/javascript', body:'window.turnstile={render:(el,opts)=>{opts.callback("isolated-captcha");return "fixture"},remove:()=>{}}' }))
  await page.route('https://pyr-e2e.example.test/**', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)
    const body = route.request().postData() ? (() => { try { return route.request().postDataJSON() as Record<string,unknown> } catch { return {} } })() : {}
    if(name === 'settings') return route.fulfill({json:{external:{email:true,google:false},disable_signup:false,mailer_autoconfirm:options.autoConfirm??false}})
    if(name === 'signup') { signupBodies.push(body); return route.fulfill({json:{user:{id:api.uid,email:body.email,identities:[]},session:null}}) }
    if(name === 'pyr_unibague_external_registration_ready') return route.fulfill({json:options.serverReady??true})
    if(name === 'pyr_unibague_current_roles') return route.fulfill({json:enrolled?[role]:[]})
    if(name === 'pyr_unibague_start_external_onboarding') { enrolled=true; return route.fulfill({json:null}) }
    if(name === 'pyr_unibague_register_organization') {
      api.table('Organizations').push({...Object.fromEntries(Object.entries(body).map(([key,value])=>[key.slice(2),value])),id:api.oid,status:'pending_review',created_by:api.uid,verified_at:null,verified_by:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()})
      api.table('OrganizationMembers').push({id:'p11-member',organization_id:api.oid,user_id:api.uid,can_manage:true,is_primary_contact:true,membership_role:'owner',status:'active'})
      return route.fulfill({json:api.oid})
    }
    if(name === 'pyr_unibague_submit_organization') {
      Object.assign(api.table('Organizations').find(org=>org.id===body.p_organization_id)!,{status:'submitted'})
      api.table('AuditLogs').push({id:crypto.randomUUID(),actor_user_id:api.uid,action:'ORGANIZATION_SUBMITTED',entity_id:body.p_organization_id,entity_table:'PYRUnibague_Organizations',created_at:new Date().toISOString()})
      return route.fulfill({json:null})
    }
    if(name === 'pyr_unibague_save_organization_contact') {
      if(body.p_is_primary) api.table('OrganizationContacts').forEach(contact=>{contact.is_primary=false})
      api.table('OrganizationContacts').push({id:crypto.randomUUID(),organization_id:body.p_organization_id,full_name:body.p_full_name,email:body.p_email,is_primary:body.p_is_primary})
      return route.fulfill({json:'contact'})
    }
    if(new URL(route.request().url()).pathname.includes('/storage/v1/object/')) return route.fulfill({json:{Key:'isolated'}})
    return route.fallback()
  })
  return { ...api, signupBodies }
}
async function login(page: Page, external=true) {
  await page.goto(external?'/login/organizaciones':'/login/institucional'); await page.getByLabel('Correo electrónico').fill('p11@external.example.test'); await page.getByLabel('Contraseña',{exact:true}).fill('isolated-password'); await page.getByRole('button',{name:'Ingresar',exact:true}).click()
}
for(const width of [320,390,768,1440]) test(`dual access pages are accessible and fit ${width}px`,async({page})=>{
  await fixture(page,'ORGANIZATION', {serverReady:false})
  await page.setViewportSize({width,height:1000})
  for(const route of ['/login','/login/institucional','/login/organizaciones','/registro/organizacion']) {
    await page.goto(route); await expect(page.getByRole('heading',{level:1})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
    expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations).toEqual([])
    if(width===390||width===1440){await mkdir('docs/p11/screens',{recursive:true});await page.screenshot({path:`docs/p11/screens/${route.replaceAll('/','-').slice(1)}-${width}.png`,fullPage:true})}
  }
  await page.goto('/login'); const link=page.getByRole('link',{name:/Acceso universitario/});await link.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/login\/institucional$/)
  await expect(page.getByRole('button',{name:'Continuar con mi cuenta Unibagué'})).toBeDisabled()
})
test('unsafe hosted autoconfirm keeps signup closed without any account request',async({page})=>{
  const api=await fixture(page,'ORGANIZATION',{autoConfirm:true})
  await page.goto('/registro/organizacion');await expect(page.getByText('Registro público pendiente de activación')).toBeVisible()
  await expect(page.getByLabel('Correo de contacto')).toBeDisabled();expect(api.signupBodies).toHaveLength(0)
})
test('isolated signup confirms email through PKCE and starts restricted onboarding',async({page})=>{
  const api=await fixture(page,'ORGANIZATION',{enrolled:false})
  api.tables.PYRUnibague_Organizations=[];api.tables.PYRUnibague_OrganizationMembers=[]
  await page.goto('/registro/organizacion');await expect(page.getByLabel('Nombre',{exact:true})).toBeEnabled()
  await page.getByLabel('Nombre',{exact:true}).fill('Ana');await page.getByLabel('Apellidos').fill('Prueba');await page.getByLabel('Correo de contacto').fill('p11@external.example.test')
  await page.getByLabel('Contraseña',{exact:true}).fill('isolated-password');await page.getByLabel('Confirma la contraseña').fill('isolated-password');await page.getByLabel('Acepto las condiciones institucionales y el tratamiento de datos').check()
  await page.getByRole('button',{name:'Solicitar cuenta y confirmar correo'}).click();await expect(page.getByText('Solicitud recibida')).toBeVisible()
  expect(api.signupBodies).toHaveLength(1);expect(api.signupBodies[0]?.data).toEqual({display_name:'Ana Prueba'});expect(api.signupBodies[0]?.gotrue_meta_security).toEqual({captcha_token:'isolated-captcha'})
  await page.goto('/auth/callback?code=isolated-confirmation&flow=organization');await expect(page.getByRole('button',{name:'Continuar con la solicitud de organización'})).toBeVisible()
  await page.getByRole('button',{name:'Continuar con la solicitud de organización'}).click();await expect(page).toHaveURL(/\/app\/organization$/)
  await expect(page.getByLabel('Nombre legal')).toBeVisible()
  await page.goto('/app/admin');await expect(page).toHaveURL(/\/unauthorized$/)
})
test('pending organization corrects documents and resubmits while keeping observations',async({page})=>{
  const api=await fixture(page);api.table('Organizations')[0]!.status='changes_required'
  api.table('OrganizationReviews').push({id:'review-p11',organization_id:api.oid,decision:'changes_required',notes:'Actualiza el soporte',created_at:new Date().toISOString()})
  await login(page);await expect(page.getByRole('button',{name:'Reenviar solicitud corregida'})).toBeEnabled()
  await page.goto('/app/organization/documents');await page.getByLabel('Categoría',{exact:true}).fill('Soporte aportado');await page.getByLabel('Archivo',{exact:true}).setInputFiles('tests/fixtures/TEST-CV.pdf');await page.getByRole('button',{name:'Subir documento',exact:true}).click()
  await expect(page.getByText('Documento guardado')).toBeVisible();expect(api.table('OrganizationDocuments')).toHaveLength(1)
  await page.goto('/app/organization/reviews');await expect(page.getByText('Actualiza el soporte')).toBeVisible();await page.getByRole('button',{name:'Reenviar solicitud corregida'}).click();await page.getByRole('dialog').getByRole('button',{name:'Enviar a coordinación'}).click()
  await expect(page.getByText('Solicitud enviada',{exact:true})).toBeVisible();expect(api.table('OrganizationReviews')).toHaveLength(1);expect(api.table('Organizations')[0]?.status).toBe('submitted')
})
test('ADMIN sees contacts and request date and publishes P4 approval with history',async({page})=>{
  const api=await fixture(page,'ADMIN');api.table('OrganizationContacts').push({id:'contact-p11',organization_id:api.oid,full_name:'Interlocutor P11',email:'contact@external.test',is_primary:true})
  api.table('AuditLogs').push({id:'submission-p11',entity_id:api.oid,entity_table:'PYRUnibague_Organizations',action:'ORGANIZATION_SUBMITTED',actor_user_id:api.uid,created_at:'2026-10-16T15:00:00Z'})
  await login(page,false);await page.goto('/app/admin/organizations/'+api.oid)
  await expect(page.getByRole('heading',{name:'Solicitud y responsable'})).toBeVisible();await expect(page.getByRole('heading',{name:'Interlocutor P11 · Principal'})).toBeVisible();await expect(page.getByText('Última solicitud enviada')).toBeVisible()
  await expect(page.getByText(/16\/10\/2026/)).toBeVisible()
  await page.getByLabel('Decisión',{exact:true}).selectOption('approved');await page.getByLabel('Observaciones').fill('Aprobación aislada P11');await page.getByRole('button',{name:'Revisar decisión'}).click();await page.getByRole('dialog').getByRole('button',{name:'Publicar decisión'}).click()
  await expect(page.getByText('Aprobación aislada P11',{exact:true})).toBeVisible();expect(api.table('Organizations')[0]?.verified_at).toBeTruthy();expect(api.table('OrganizationReviews')).toHaveLength(1)
})
