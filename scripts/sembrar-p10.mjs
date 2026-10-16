// Seeding idempotente del piloto conocido; nunca crea identidades ni cambia roles.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { ledger, login, check, save } from './p10-context.mjs'
if(!process.argv.includes('--apply')) throw Error('Requiere --apply y registro P9 rotado del proyecto autorizado.')
assert.ok(ledger.accounts.every(a=>a.rotated_at),'Rotar todas las cuentas antes de sembrar')
const students=ledger.accounts.filter(a=>a.role==='STUDENT'),orgs=ledger.accounts.filter(a=>a.role==='ORGANIZATION'),advisors=ledger.accounts.filter(a=>a.role==='ADVISOR')
const a=await login(ledger.accounts.find(a=>a.role==='ADMIN'))
const table=(c,t)=>c.from('PYRUnibague_'+t)
const rows=async(c,t,filter)=>check(await table(c,t).select('*').match(filter),t)
async function ensure(c,t,filter,fields={}) {
 const found=await rows(c,t,filter);assert.ok(found.length<=1,'Registro ambiguo '+t)
 return found[0]??check(await table(c,t).insert({...filter,...fields}).select('*').single(),'Crear '+t)
}
let f
try{f=JSON.parse(await readFile('work/p10/fixtures.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e;f={batch:'TEST-P10',students:[],participations:[],organizations:[],projects:[],positions:[],calls:[],groups:[]}}
assert.equal(f.batch,'TEST-P10')
const persist=()=>save('fixtures.json',f)
f.period=check(await table(a,'AcademicPeriods').select('*').eq('code','2026B').single(),'Periodo reutilizado')
assert.ok(f.period.is_current&&f.period.status==='active','No alterar el periodo institucional')
f.programs=await rows(a,'AcademicPrograms',{active:true});assert.ok(f.programs.some(p=>p.code==='TEST-SIS')&&f.programs.some(p=>p.code==='TEST-MEC'))
f.municipalities=await rows(a,'Municipalities',{active:true});assert.ok(f.municipalities.length>=2)
f.type=check(await table(a,'OrganizationTypes').select('*').eq('code','TEST-P8').single(),'Tipo TEST reutilizado')
f.skill=check(await table(a,'Skills').select('*').eq('name','TEST P8 programación').single(),'Habilidad TEST reutilizada')
f.staff=[]
for(const u of advisors)f.staff.push(check(await table(a,'StaffProfiles').select('*').eq('user_id',u.user_id).eq('status','active').single(),'Asesor P9 existente'))
const sc=[]
for(const [i,u] of students.entries()) {
 const s=await login(u);sc.push(s)
 const program=f.programs.find(p=>p.code===(i===1?'TEST-MEC':'TEST-SIS'))
 const edit={student_code:`TEST-P10-E${i+1}`,academic_program_id:program.id,current_semester:8,bio:'TEST P10 · Perfil ficticio de demostración institucional.',desired_work_description:'TEST desarrollo software automatización e impacto territorial',origin_municipality_id:f.municipalities[0].id,current_municipality_id:f.municipalities[i%2].id}
 f.students[i]=await ensure(s,'Students',{user_id:u.user_id},edit)
 assert.ok(f.students[i].student_code.startsWith('TEST-P10-'),'No sobrescribir un perfil ajeno')
 f.students[i]=check(await table(s,'Students').update(edit).eq('id',f.students[i].id).select('*').single(),'Perfil propio')
 await ensure(s,'StudentSkills',{student_id:f.students[i].id,skill_id:f.skill.id},{evidence_text:'TEST P10 · prototipo académico ficticio'})
 await ensure(s,'StudentInterests',{student_id:f.students[i].id,label:'TEST P10 · Innovación territorial'},{description:'Interés ficticio en soluciones comunitarias',sort_order:0})
 await ensure(s,'StudentExperiences',{student_id:f.students[i].id,title:'TEST P10 · Voluntariado académico'},{organization_name:'TEST comunidad ficticia',description:'Prototipo de demostración',started_on:'2026-02-01',ended_on:'2026-05-30',is_current:false})
 check(await s.rpc('pyr_unibague_set_student_preferences',{p_student_id:f.students[i].id,p_municipality_ids:f.municipalities.map(m=>m.id)}),'Preferencias propias')
 // Mismo flujo persistido usado por saveParticipation de ADMIN. No hay RPC sustitutiva.
 check(await table(a,'StudentPeriodParticipations').upsert({student_id:f.students[i].id,academic_period_id:f.period.id,status:'active',eligible_for_matching:i!==3},{onConflict:'student_id,academic_period_id'}),'Participación ADMIN')
 f.participations[i]=check(await table(a,'StudentPeriodParticipations').select('*').eq('student_id',f.students[i].id).eq('academic_period_id',f.period.id).single(),'Participación persistida')
 const docs=await rows(s,'StudentDocuments',{student_id:f.students[i].id,file_name:'TEST-P10-CV.pdf'})
 const bytes=await readFile(process.env.PYR_TEST_CV_FILE||'tests/fixtures/TEST-CV.pdf')
 assert.ok(bytes.subarray(0,5).toString()==='%PDF-'&&bytes.includes(Buffer.from('startxref')),'Se requiere PDF TEST válido')
 if(!docs.length) {
  const id=randomUUID(),path=`${f.students[i].id}/${id}/TEST-P10-CV.pdf`,bucket='pyrunibague-student-documents'
  check(await s.storage.from(bucket).upload(path,bytes,{contentType:'application/pdf',upsert:false}),'Documento privado propio')
  check(await table(s,'StudentDocuments').insert({id,student_id:f.students[i].id,category_code:'CV',file_name:'TEST-P10-CV.pdf',bucket_id:bucket,object_path:path,mime_type:'application/pdf',size_bytes:bytes.length,status:'uploaded',uploaded_by:u.user_id}),'Metadata documento TEST')
 }else if(docs[0].size_bytes!==bytes.length) {
  const doc=docs[0]
  assert.equal(doc.uploaded_by,u.user_id,'Solo corregir el documento TEST propio')
  assert.ok(doc.object_path.startsWith(f.students[i].id+'/'))
  check(await s.storage.from(doc.bucket_id).upload(doc.object_path,bytes,{contentType:'application/pdf',upsert:true}),'Actualizar PDF TEST propio')
  check(await table(s,'StudentDocuments').update({size_bytes:bytes.length}).eq('id',doc.id),'Actualizar metadata TEST')
 }
 await persist()
}
const oc=[]
for(const [i,u] of orgs.entries()) {
 const c=await login(u);oc.push(c)
 const name=`TEST P10 Organización ${i+1}`
 const found=await rows(c,'Organizations',{legal_name:name});assert.ok(found.length<=1)
 if(!found[0]) {
  const id=check(await c.rpc('pyr_unibague_register_organization',{p_legal_name:name,p_display_name:name,p_description:'TEST P10 · Organización ficticia, sin participantes reales.',p_organization_type_id:f.type.id,p_municipality_id:f.municipalities[i].id}),'Registro organización con RPC')
  f.organizations[i]=check(await table(c,'Organizations').select('*').eq('id',id).single(),'Organización propia')
 } else f.organizations[i]=found[0]
 const org=f.organizations[i]
 const memberships=await rows(c,'OrganizationMembers',{organization_id:org.id,user_id:u.user_id,status:'active'})
 assert.ok(memberships.some(m=>m.can_manage),'Titular legítimo obligatorio')
 if(org.status!=='approved')check(await a.rpc('pyr_unibague_review_organization',{p_organization_id:org.id,p_decision:'approved',p_notes:'TEST P10 · Aprobación para demostración controlada.'}),'Revisión ADMIN')
 let contacts=await rows(c,'OrganizationContacts',{organization_id:org.id,full_name:`TEST P10 Interlocutor ${i+1}`})
 if(!contacts.length) {
  check(await c.rpc('pyr_unibague_save_organization_contact',{p_organization_id:org.id,p_full_name:`TEST P10 Interlocutor ${i+1}`,p_position_title:'TEST enlace institucional',p_is_primary:true}),'Interlocutor RPC')
  contacts=await rows(c,'OrganizationContacts',{organization_id:org.id,full_name:`TEST P10 Interlocutor ${i+1}`})
 }
 f.projects[i]=await ensure(c,'Projects',{organization_id:org.id,name:`TEST P10 Proyecto ${i+1}`},{academic_period_id:f.period.id,summary:'TEST desarrollo software automatización',description:'TEST P10 · Demostración ficticia de trabajo interdisciplinario.',municipality_id:f.municipalities[i].id,zone_type:i?'rural':'urban',modality:'Presencial (TEST)',status:'draft',created_by:u.user_id})
 assert.equal(f.projects[i].academic_period_id,f.period.id)
 await ensure(c,'ProjectInterlocutors',{project_id:f.projects[i].id,organization_contact_id:contacts[0].id},{is_primary_for_project:true})
 const specs=i?[['Sistemas', 'TEST-SIS',2]]:[['Sistemas','TEST-SIS',2],['Mecánica','TEST-MEC',1]]
 for(const [label,code,capacity] of specs) {
  const pos=await ensure(c,'ProjectPositions',{project_id:f.projects[i].id,title:`TEST P10 Plaza ${i+1} ${label}`},{description:'TEST desarrollo software automatización',capacity,status:'active',is_active:true})
  assert.ok(pos.is_active&&pos.capacity===capacity)
  await ensure(c,'ProjectPositionPrograms',{project_position_id:pos.id,academic_program_id:f.programs.find(p=>p.code===code).id},{is_required:true})
  if(!f.positions.some(p=>p.id===pos.id))f.positions.push(pos)
 }
 f.calls[i]=await ensure(c,'Calls',{organization_id:org.id,title:`TEST P10 Convocatoria ${i+1}`},{academic_period_id:f.period.id})
 for(const pos of f.positions.filter(p=>p.project_id===f.projects[i].id))await ensure(c,'CallPositions',{call_id:f.calls[i].id,project_position_id:pos.id})
 if(['draft','changes_required'].includes(f.projects[i].status))check(await table(c,'Projects').update({status:'submitted'}).eq('id',f.projects[i].id),'Envío de proyecto')
 check(await table(a,'Projects').update({status:'approved'}).eq('id',f.projects[i].id),'Aprobación ADMIN proyecto')
 if(f.calls[i].status==='draft')check(await table(c,'Calls').update({status:'submitted'}).eq('id',f.calls[i].id),'Envío convocatoria')
 if(f.calls[i].status!=='open')check(await table(a,'Calls').update({status:'open'}).eq('id',f.calls[i].id),'Convocatoria aprobada')
 const responsibilities=await rows(a,'AdvisorOrganizationAssignments',{organization_id:org.id,academic_period_id:f.period.id,is_current:true})
 if(responsibilities[0]?.advisor_id!==f.staff[i].id)check(await a.rpc('pyr_unibague_change_organization_advisor',{p_organization_id:org.id,p_academic_period_id:f.period.id,p_advisor_id:f.staff[i].id}),'Asesor de organización manual')
 f.groups[i]=await ensure(c,'Groups',{project_id:f.projects[i].id,name:`TEST P10 Equipo ${i+1}`},{started_on:'2026-10-16'})
 await persist()
}
f.historicalPosition=await ensure(a,'ProjectPositions',{project_id:f.projects[0].id,title:'TEST P10 Plaza histórica inactiva'},{description:'TEST P10 · Capacidad histórica, excluida de la oferta vigente.',capacity:3,status:'closed',is_active:false})
assert.equal(f.historicalPosition.is_active,false)
const snapshot=async()=>check(await a.rpc('pyr_unibague_assignment_snapshot',{p_period_id:f.period.id,p_run_id:null}),'Snapshot ADMIN')
async function action(kind,index,pos) {
 const state=await snapshot()
 const prior=kind==='confirm'?null:(await rows(a,'Assignments',{student_id:f.students[index].id,academic_period_id:f.period.id,is_active:true}))[0]
 check(await a.rpc(`pyr_unibague_${kind}_assignment`,{p_period_id:f.period.id,p_run_id:null,p_revision:state.revision,p_action:{student_id:f.students[index].id,...(prior?{assignment_id:prior.id}:{}),...(pos?{position_id:pos.id}:{}),source:'MANUAL',allow_unscored:true,reason_code:'COORDINATION_REQUEST',reason_text:'TEST P10 · Escenario controlado del piloto.'}}),'Acción ADMIN '+kind)
}
for(const i of [0,1]) {
 const current=await rows(a,'Assignments',{student_id:f.students[i].id,academic_period_id:f.period.id,is_active:true})
 const pos=f.positions.find(p=>p.project_id===f.projects[0].id&&p.title.includes(i?'Mecánica':'Sistemas'))
 if(!current.length)await action('confirm',i,pos)
 else assert.equal(current[0].project_position_id,pos.id,'No alterar otra asignación vigente')
 const assignment=(await rows(a,'Assignments',{student_id:f.students[i].id,academic_period_id:f.period.id,is_active:true}))[0]
 await ensure(oc[0],'GroupMembers',{group_id:f.groups[0].id,assignment_id:assignment.id},{joined_on:'2026-10-16'})
}
// Un único ciclo histórico para E3: luego queda elegible y sin asignación.
const history=await rows(a,'Assignments',{student_id:f.students[2].id,academic_period_id:f.period.id})
if(!history.length)await action('confirm',2,f.positions.find(p=>p.project_id===f.projects[1].id))
const activeThird=await rows(a,'Assignments',{student_id:f.students[2].id,academic_period_id:f.period.id,is_active:true})
if(activeThird.length) {
 assert.ok(f.positions.some(p=>p.id===activeThird[0].project_position_id),'No desasignar una plaza ajena')
 await ensure(oc[1],'GroupMembers',{group_id:f.groups[1].id,assignment_id:activeThird[0].id},{joined_on:'2026-10-16'})
 await action('unassign',2)
}
// Responsabilidades individuales explícitas, independientes del asesor organizacional.
for(const [i,staffIndex] of [[0,0],[1,1],[2,1]]) {
 const old=await rows(a,'AdvisorStudentAssignments',{participation_id:f.participations[i].id,is_current:true})
 if(old[0]?.advisor_id!==f.staff[staffIndex].id)check(await a.rpc('pyr_unibague_change_student_advisor',{p_participation_id:f.participations[i].id,p_advisor_id:f.staff[staffIndex].id}),'Asesor individual manual')
}
f.assignments=check(await table(a,'Assignments').select('*').in('student_id',f.students.map(s=>s.id)).eq('academic_period_id',f.period.id),'Asignaciones P10')
assert.equal(f.assignments.filter(x=>x.is_active).length,2)
assert.equal(f.assignments.filter(x=>x.is_active&&x.student_id===f.students[2].id).length,0)
assert.equal((await rows(a,'Assignments',{student_id:f.students[3].id,academic_period_id:f.period.id})).length,0)
await persist()
console.log('PASS TEST P10: 4 estudiantes, 2 organizaciones, 2 proyectos, 3 plazas activas y 1 histórica inactiva, 2 convocatorias, 2 equipos; 2 asignados, 1 elegible sin asignar, 1 no elegible.')
