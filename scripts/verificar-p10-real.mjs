import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ledger, login, check, publicClient, management, save } from './p10-context.mjs'
import { solveAssignments } from '../src/features/optimizer/solveAssignments.ts'
const f=JSON.parse(await readFile('work/p10/fixtures.json','utf8')),report=[]
const clients=[]
for(const u of ledger.accounts)clients.push({u,c:await login(u)})
const byRole=role=>clients.filter(x=>x.u.role===role).map(x=>x.c)
const [a]=byRole('ADMIN'),sc=byRole('STUDENT'),oc=byRole('ORGANIZATION'),dc=byRole('ADVISOR')
const rows=async(c,t,filter)=>check(await c.from('PYRUnibague_'+t).select('*').match(filter),t)
const pass=(label,detail)=>{report.push({label,status:'PASS',...detail});console.log('PASS',label)}
try {
 for(const [i,c] of sc.entries()) {
  const s=f.students[i]
  assert.equal((await rows(c,'Students',{id:s.id})).length,1)
  for(const table of ['StudentSkills','StudentInterests','StudentLocationPreferences','StudentDocuments'])assert.ok((await rows(c,table,{student_id:s.id})).length>0,table)
  const participation=(await rows(c,'StudentPeriodParticipations',{student_id:s.id,academic_period_id:f.period.id}))[0]
  assert.equal(participation.eligible_for_matching,i!==3)
  const view=check(await c.rpc('pyr_unibague_student_assignment',{p_period_id:f.period.id}),'Mi asignación')
  if(i<2) {
   assert.equal(view.organization,f.organizations[0].legal_name);assert.equal(view.group,f.groups[0].name)
   assert.ok(view.teammates.some(p=>p.name===ledger.accounts.filter(x=>x.role==='STUDENT')[i?0:1].display_name))
   assert.equal(view.advisor,ledger.accounts.filter(x=>x.role==='ADVISOR')[i].display_name)
   assert.ok((await rows(c,'Notifications',{})).length)
  }else assert.equal(view,null)
  assert.deepEqual(await rows(c,'Students',{id:f.students[(i+1)%4].id}),[])
  const forbidden=await c.from('PYRUnibague_StudentPeriodParticipations').update({eligible_for_matching:!participation.eligible_for_matching}).eq('id',participation.id).select('id')
  assert.ok(forbidden.error?.code==='42501'||JSON.stringify(forbidden.data)==='[]','La elegibilidad pertenece a ADMIN')
  assert.equal((await rows(a,'StudentPeriodParticipations',{id:participation.id}))[0].eligible_for_matching,i!==3)
  const doc=(await rows(c,'StudentDocuments',{student_id:s.id}))[0]
  const signed=check(await c.storage.from(doc.bucket_id).createSignedUrl(doc.object_path,60),'Signed URL propia')
  assert.equal((await fetch(signed.signedUrl)).status,200)
  const publicUrl=c.storage.from(doc.bucket_id).getPublicUrl(doc.object_path).data.publicUrl
  assert.ok([400,403,404].includes((await fetch(publicUrl)).status))
  assert.ok((await sc[(i+1)%4].storage.from(doc.bucket_id).createSignedUrl(doc.object_path,60)).error)
  pass(`Estudiante ${i+1}: perfil, participación, asignación, equipo y documentos privados`)
 }
 for(const [i,c] of oc.entries()) {
  const own=f.organizations[i],foreign=f.organizations[i?0:1]
  assert.equal((await rows(c,'Organizations',{id:own.id})).length,1)
  assert.deepEqual(await rows(c,'Organizations',{id:foreign.id}),[])
  assert.deepEqual(check(await c.from('PYRUnibague_Organizations').update({description:'PROHIBIDO'}).eq('id',foreign.id).select('id'),'Escritura cruzada'),[])
  assert.ok((await rows(c,'OrganizationContacts',{organization_id:own.id})).length)
  assert.ok((await rows(c,'Calls',{organization_id:own.id})).length)
  const team=check(await c.rpc('pyr_unibague_project_team',{p_project_id:f.projects[i].id}),'Equipo propio')
  assert.ok(team.groups.length)
  if(!i)assert.equal(team.members.filter(m=>m.status==='active').length,2)
  else assert.ok(team.members.some(m=>m.status==='inactive'))
  assert.equal((await c.rpc('pyr_unibague_project_team',{p_project_id:f.projects[i?0:1].id})).error?.code,'42501')
  pass(`Organización ${i+1}: titularidad, interlocutores, proyectos, convocatoria, equipos y aislamiento`)
 }
 for(const [i,c] of dc.entries()) {
  const w=check(await c.rpc('pyr_unibague_advisor_workspace',{p_academic_period_id:f.period.id}),'Espacio asesor')
  assert.ok(w.organizations.some(o=>o.id===f.organizations[i].id));assert.ok(w.projects.length)
  assert.ok(w.students.some(s=>s.participation_id===f.participations[i].id))
  assert.ok(!w.students.some(s=>s.participation_id===f.participations[i?0:1].id))
  pass(`Asesor ${i+1}: organizaciones y estudiantes independientes`)
 }
 const prior=check(await sc[0].rpc('pyr_unibague_student_assignment',{p_period_id:f.period.id}),'Asesor previo').advisor
 try {
  check(await a.rpc('pyr_unibague_change_organization_advisor',{p_organization_id:f.organizations[0].id,p_academic_period_id:f.period.id,p_advisor_id:f.staff[1].id}),'Cambiar asesor organización')
  assert.equal(check(await sc[0].rpc('pyr_unibague_student_assignment',{p_period_id:f.period.id}),'Asesor independiente').advisor,prior)
 }finally{check(await a.rpc('pyr_unibague_change_organization_advisor',{p_organization_id:f.organizations[0].id,p_academic_period_id:f.period.id,p_advisor_id:f.staff[0].id}),'Restaurar asesor TEST')}
 pass('Cambiar asesor organizacional conserva asesor individual e historial')
 const notification=(await rows(sc[0],'Notifications',{}))[0]
 assert.deepEqual(await rows(sc[1],'Notifications',{id:notification.id}),[])
 assert.equal(check(await sc[1].rpc('pyr_unibague_mark_notification_read',{notification_id:notification.id}),'Notificación ajena'),false)
 pass('Notificaciones personales aisladas')
 for(const c of [...sc,...oc,...dc])assert.equal((await c.rpc('pyr_unibague_confirm_assignment',{p_period_id:f.period.id,p_run_id:null,p_revision:'forged',p_action:{}})).error?.code,'42501')
 pass('Confirmación administrativa denegada a las ocho cuentas no ADMIN')
 const configs=await rows(a,'MatchingConfigurations',{name:'TEST P10 estructurado'})
 const config=configs[0]??check(await a.from('PYRUnibague_MatchingConfigurations').insert({academic_period_id:f.period.id,name:'TEST P10 estructurado',algorithm_version:'hybrid-v0.1',minimum_recommended_score:50,weights:{academic:45,skills:25,experience:0,interests:0,location:15,preference:15,semantic:0},rules:{requiredSkillsAreHardConstraint:true,semanticEnabled:false},is_active:true}).select('*').single(),'Configuración TEST')
 for(const c of [sc[0],oc[0],dc[0]]) {
  const result=await c.functions.invoke('matching-run',{body:{academic_period_id:f.period.id,matching_configuration_id:config.id}})
  assert.ok(result.error,'Matching exclusivo ADMIN')
 }
 const match=check(await a.functions.invoke('matching-run',{body:{academic_period_id:f.period.id,matching_configuration_id:config.id}}),'Matching Edge real')
 assert.equal(match.summary.semantic_mode,'structured_only')
 const candidates=await rows(a,'MatchCandidates',{matching_run_id:match.run_id})
 assert.ok(candidates.some(c=>c.student_id===f.students[2].id))
 assert.ok(!candidates.some(c=>c.student_id===f.students[3].id))
 const snapshot=check(await a.rpc('pyr_unibague_assignment_snapshot',{p_period_id:f.period.id,p_run_id:match.run_id}),'Snapshot real')
 const proposal=solveAssignments(snapshot)
 assert.ok(proposal.rows.some(r=>r.studentId===f.students[2].id),'Optimización incluye E3 elegible')
 assert.ok(!proposal.rows.some(r=>r.studentId===f.students[3].id))
 await save('matching-optimizer.json',{match,proposal})
 f.runId=match.run_id;f.matchingConfig=config;f.notificationId=notification.id;await save('fixtures.json',f)
 pass('Matching estructurado y optimización global sobre candidatos persistidos')
 for(const kind of ['assignments','positions'])assert.ok(check(await a.rpc('pyr_unibague_operational_export',{p_period_id:f.period.id,p_kind:kind}),'Exportación ADMIN').length)
 check(await a.rpc('pyr_unibague_operational_summary',{p_period_id:f.period.id}),'Pendientes')
 assert.ok((await rows(a,'AuditLogs',{})).length)
 pass('ADMIN: pendientes, exportaciones y auditoría reales')
 const schema=await management('/database/query',{query:`select (select count(*) from pg_tables where schemaname='public' and tablename like 'PYRUnibague_%')::int tables,(select count(*) from pg_tables where schemaname='public' and tablename like 'PYRUnibague_%' and rowsecurity)::int rls,(select count(*) from supabase_migrations.schema_migrations)::int migrations,(select count(*) from storage.buckets where not public)::int private_buckets`})
 assert.deepEqual(schema[0],{tables:45,rls:45,migrations:14,private_buckets:2})
 const anon=await publicClient(),anonymous=await anon.from('PYRUnibague_Students').select('id')
 assert.ok(anonymous.error?.code==='42501'||JSON.stringify(anonymous.data)==='[]')
 pass('Esquema intacto: 45 tablas con RLS, 14 migraciones, dos buckets privados; anonimato denegado')
}catch(e){report.push({status:'FAIL',error:e.message});throw e}
finally {await save('real-results.json',report);for(const x of clients)await x.c.auth.signOut({scope:'local'})}
