// Real Auth/Data/Storage; mutations restricted to the local P11 TEST ledger.
// No mail, SQL, schema changes, traces, response bodies or secrets in reports.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { adminClient, publicClient, check, ref } from './supabase-admin.mjs'
const ledger = JSON.parse(await readFile('work/p11/cuentas-test.local.json', 'utf8'))
assert.equal(ledger.project_ref, ref); assert.equal(ledger.accounts.length, 9)
const admin = await adminClient(), clients = [], results = []
const table = (c, name) => c.from('PYRUnibague_' + name)
const rows = async (c, name, filters = {}) => check(await table(c, name).select('*').match(filters), name)
async function test(label, run) {
  try { await run(); results.push({ label, status: 'PASS' }); console.log('PASS', label) }
  catch (error) { results.push({ label, status: 'FAIL', error: error.message }); console.log('FAIL', label, error.message); process.exitCode = 1 }
}
const skip = (label, reason) => results.push({ label, status: 'SKIPPED', reason })
const testIds = new Set(ledger.accounts.map(a => a.user_id))
const unrelated = async () => (await rows(admin, 'UserProfiles')).filter(p => !testIds.has(p.user_id)).sort((a,b) => a.user_id.localeCompare(b.user_id))
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const before = digest(await unrelated())
try {
  for (const account of ledger.accounts) {
    await test(`Auth, perfil y rol ${account.role} ${account.email}`, async () => {
      const identity = check(await admin.auth.admin.getUserById(account.user_id), 'Identidad TEST').user
      assert.ok(identity.user_metadata?.pyr_test_account && identity.app_metadata?.pyr_test_batch === 'P11')
      assert.equal(identity.email, account.email)
      const c = await publicClient(); clients.push({ c, account })
      const data = check(await c.auth.signInWithPassword({ email: account.email, password: account.password }), 'Login TEST')
      assert.equal(data.user.id, account.user_id)
      assert.deepEqual(check(await c.rpc('pyr_unibague_current_roles'), 'Roles'), [account.role])
      assert.match((await rows(c, 'UserProfiles', { user_id: account.user_id }))[0].display_name, /\(TEST\)/)
      if (account.role === 'ADVISOR') assert.equal((await rows(c, 'StaffProfiles', { user_id: account.user_id }))[0].status, 'active')
    })
  }
  assert.equal(clients.length, 9)
  const byRole = role => clients.filter(x => x.account.role === role)
  const [{ c: a }] = byRole('ADMIN'), orgs = byRole('ORGANIZATION'), students = byRole('STUDENT'), advisors = byRole('ADVISOR')
  const anon = await publicClient()
  await test('Anónimo sin datos privados', async () => {
    for (const name of ['UserProfiles','UserRoles','Organizations','OrganizationDocuments']) {
      const r = await table(anon, name).select('*')
      assert.ok(r.error || r.data.length === 0)
    }
  })
  // Deliberately identified fictional reference rows; no institutional requirements.
  async function ensure(name, filter, fields) {
    const current = await rows(a, name, filter); assert.ok(current.length <= 1)
    return current[0] ?? check(await table(a, name).insert({ ...filter, ...fields }).select('*').single(), `Fixture TEST ${name}`)
  }
  const type = await ensure('OrganizationTypes', { code: 'TEST-P11' }, { name: 'TEST P11 · Organización ficticia' })
  const municipality = await ensure('Municipalities', { municipality_code: 'TEST-P11', department_code: 'TEST-P11' }, { municipality_name: 'TEST P11 · Municipio ficticio', department_name: 'TEST P11 · Departamento ficticio' })
  const fixtures = []
  for (const [i, { c, account }] of orgs.entries()) {
    await test(`Solicitud TEST ${i + 1}, membresía y contacto persistidos`, async () => {
      const input = { p_legal_name: `TEST P11 Organización ${i + 1}`, p_description: 'Solicitud ficticia de validación P11', p_organization_type_id: type.id, p_municipality_id: municipality.id }
      const id = check(await c.rpc('pyr_unibague_register_organization', input), 'Registro TEST')
      assert.equal(check(await c.rpc('pyr_unibague_register_organization', input), 'Reintento'), id)
      const org = (await rows(c, 'Organizations', { id }))[0]
      assert.equal(org.created_by, account.user_id)
      if (!['approved','rejected','changes_required'].includes(org.status)) assert.equal(org.status, 'pending_review')
      assert.equal((await rows(c, 'OrganizationMembers', { organization_id: id, user_id: account.user_id }))[0].can_manage, true)
      const contact = (await rows(c, 'OrganizationContacts', { organization_id: id, is_primary: true }))[0]
      check(await c.rpc('pyr_unibague_save_organization_contact', { p_organization_id: id, p_id: contact?.id ?? null, p_full_name: 'Responsable TEST P11', p_email: account.email, p_is_primary: true }), 'Contacto TEST')
      fixtures.push({ id, user_id: account.user_id })
    })
  }
  if (fixtures.length === 2) {
    const [{ c: first }, { c: second }] = orgs
    const id = fixtures[0].id, foreign = fixtures[1].id
    await test('RLS entre organizaciones, contactos, revisiones y escrituras', async () => {
      assert.deepEqual(await rows(first, 'Organizations', { id: foreign }), [])
      for (const name of ['OrganizationContacts','OrganizationReviews','OrganizationDocuments']) assert.deepEqual(await rows(first, name, { organization_id: foreign }), [])
      assert.deepEqual(check(await table(first,'Organizations').update({description:'Forbidden TEST'}).eq('id',foreign).select('id'), 'Escritura cruzada'), [])
      assert.ok((await first.rpc('pyr_unibague_review_organization', { p_organization_id: id, p_decision: 'approved' })).error)
      const own = (await rows(first,'Organizations',{id}))[0]
      const changed = await table(first,'Organizations').update({status:'approved',verified_at:new Date().toISOString()}).eq('id',id).select('id')
      assert.ok(changed.error || changed.data.length === 0)
      assert.equal((await rows(first,'Organizations',{id}))[0].status,own.status)
    })
    await test('Documento privado TEST: acceso propio, ADMIN y denegación cruzada', async () => {
      const docId = 'b1100000-0000-0000-0000-000000000901'
      const bucket = 'pyrunibague-organization-documents', path = `${id}/${docId}/TEST-CV.pdf`
      const bytes = await readFile('tests/fixtures/TEST-CV.pdf')
      const existing = await first.storage.from(bucket).list(id+'/'+docId)
      if (!existing.data?.some(d=>d.name==='TEST-CV.pdf')) check(await first.storage.from(bucket).upload(path, bytes, {contentType:'application/pdf',upsert:false}), 'Upload privado')
      if (!(await rows(first,'OrganizationDocuments',{organization_id:id,object_path:path})).length) check(await table(first,'OrganizationDocuments').insert({id:docId,organization_id:id,category_code:'TEST-P11',file_name:'TEST-CV.pdf',bucket_id:bucket,object_path:path,status:'uploaded',uploaded_by:orgs[0].account.user_id}), 'Metadata TEST')
      const own = check(await first.storage.from(bucket).createSignedUrl(path, 60), 'URL propia')
      assert.equal((await fetch(own.signedUrl)).status,200)
      check(await a.storage.from(bucket).createSignedUrl(path,60),'URL ADMIN')
      assert.ok((await second.storage.from(bucket).createSignedUrl(path,60)).error)
      const publicUrl = first.storage.from(bucket).getPublicUrl(path).data.publicUrl
      assert.ok([400,403,404].includes((await fetch(publicUrl)).status))
    })
    const submission = await first.rpc('pyr_unibague_submit_organization',{p_organization_id:id})
    if (submission.error?.code === 'PGRST202') skip('Envío P11 hospedado','RPC ausente; requiere aplicar migración SQL, no disponible mediante Secret API Key.')
    else await test('Envío P11 hospedado', async()=>{ check(submission,'Envío P11') })
    await test('Revisión ADMIN existente: correcciones, aprobación, rechazo e historial',async()=>{
      for(const decision of ['changes_required','approved','rejected']) {
        check(await a.rpc('pyr_unibague_review_organization',{p_organization_id:id,p_decision:decision,p_notes:`TEST P11 ${decision}`}), 'Revisión ADMIN')
        const org=(await rows(first,'Organizations',{id}))[0];assert.equal(org.status,decision)
        assert.equal(Boolean(org.verified_at),decision==='approved')
      }
      assert.ok((await rows(first,'OrganizationReviews',{organization_id:id})).length>=3)
    })
  }
  await test('STUDENT y ADVISOR no administran organizaciones ni roles', async()=>{
    for(const {c,account} of [...students,...advisors]) {
      const r=await c.rpc('pyr_unibague_register_organization',{p_legal_name:'FORBIDDEN TEST P11'})
      assert.ok(r.error)
      assert.ok((await c.rpc('pyr_unibague_review_organization',{p_organization_id:fixtures[0]?.id,p_decision:'approved'})).error)
      const adminRole=(await rows(admin,'Roles',{code:'ADMIN'}))[0]
      assert.ok((await table(c,'UserRoles').insert({user_id:account.user_id,role_id:adminRole.id})).error)
    }
  })
  await test('Usuario TEST sin rol y metadata sin privilegios', async()=>{
    const {c,account}=orgs[1]
    const role=(await rows(admin,'UserRoles',{user_id:account.user_id}))[0]
    try {
      check(await table(admin,'UserRoles').delete().eq('id',role.id),'Retiro temporal rol TEST')
      check(await c.auth.updateUser({data:{role:'ADMIN'}}),'Metadata TEST')
      assert.deepEqual(check(await c.rpc('pyr_unibague_current_roles'),'Sin rol'),[])
      assert.ok((await c.rpc('pyr_unibague_register_organization',{p_legal_name:'FORBIDDEN TEST P11'})).error)
    } finally {
      check(await table(admin,'UserRoles').upsert(role),'Restaurar rol TEST')
      check(await c.auth.updateUser({data:{role:null}}),'Restaurar metadata TEST')
    }
  })
  await test('Logout invalida el refresh token TEST',async()=>{
    const c=await publicClient(), account=ledger.accounts[0]
    const session=check(await c.auth.signInWithPassword({email:account.email,password:account.password}),'Login').session
    check(await c.auth.signOut(),'Logout')
    const next=await publicClient();assert.ok((await next.auth.refreshSession({refresh_token:session.refresh_token})).error)
  })
  skip('Correo, recuperación por buzón y Google reales','SMTP/CAPTCHA/OAuth no configurados; no se envían correos a direcciones ficticias.')
  skip('RLS/pgTAP/Advisors y migraciones hospedados','Conector SQL sin permiso; no hay conexión PostgreSQL autorizada. Se prueba RLS vía Data API y SQL aislado por separado.')
  await test('Perfiles ajenos sin modificaciones', async()=>assert.equal(digest(await unrelated()),before))
  await mkdir('work/p11',{recursive:true});await writeFile('work/p11/fixtures.local.json',JSON.stringify({project_ref:ref,organizations:fixtures},null,2))
} catch(error) { results.push({label:'Preparación de pruebas reales',status:'FAIL',error:error.message});process.exitCode=1 }
finally {
  for(const {c} of clients) await c.auth.signOut()
  await mkdir('docs/p11',{recursive:true});await writeFile('docs/p11/real-validation.json',JSON.stringify({checked_at:new Date().toISOString(),project:ref,mode:'real Supabase Auth/Data/Storage',results},null,2)+'\n')
}
