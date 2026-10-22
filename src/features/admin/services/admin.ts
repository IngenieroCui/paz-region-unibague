import { allPages, check, client, FeatureError, nullable, validUrl } from '../../../lib/supabase/feature-helpers'
import type { Row } from '../../../lib/supabase/feature-helpers'
import type { Json } from '../../../lib/supabase/database.types'

export type StudentListRow = Row<'PYRUnibague_Students'> & { display_name: string|null; institutional_email: string|null }
export type StudentFilters={program:string;period:string;eligible:string;active:string;status:string;semester:string}
export async function reviewCatalogs() {
 const db=await client()
 const [programs,periods,municipalities,types]=await Promise.all([
 allPages((a,b)=>db.from('PYRUnibague_AcademicPrograms').select('*').order('name').order('id').range(a,b)),
 allPages((a,b)=>db.from('PYRUnibague_AcademicPeriods').select('*').order('created_at',{ascending:false}).order('id').range(a,b)),
 allPages((a,b)=>db.from('PYRUnibague_Municipalities').select('*').order('municipality_name').order('id').range(a,b)),
 organizationCatalogs()])
 return {programs,periods,municipalities,types}
}
export async function listStudents(page:number,search:string,filters:StudentFilters) {
  const db=await client();const result=await db.rpc('pyr_unibague_admin_students',{p_page:page,p_search:search,p_program:filters.program||null,p_period:filters.period||null,p_eligible:filters.eligible?filters.eligible==='true':null,p_active:filters.active?filters.active==='true':null,p_status:filters.status||null,p_semester:filters.semester?Number(filters.semester):null})
  check(result.error)
  const value=result.data as unknown as {rows:StudentListRow[];count:number}
  if(!value||!Array.isArray(value.rows)||typeof value.count!=='number') throw new FeatureError('Respuesta de estudiantes inválida.')
  const ids=value.rows.map(row=>row.id)
  const participations=ids.length?await allPages((a,b)=>db.from('PYRUnibague_StudentPeriodParticipations').select('*').in('student_id',ids).order('id').range(a,b)):[]
  return {rows:value.rows.map(row=>({...row,participations:participations.filter(item=>item.student_id===row.id)})),count:value.count}
}
export async function studentDetail(id:string) {
  const db=await client()
  const student=await db.from('PYRUnibague_Students').select('*').eq('id',id).single();check(student.error)
  const [profile,experiences,skills,interests,preferences,documents,participations]=await Promise.all([
    db.from('PYRUnibague_UserProfiles').select('*').eq('user_id',student.data!.user_id).single(),
    allPages((a,b)=>db.from('PYRUnibague_StudentExperiences').select('*').eq('student_id',id).order('created_at').order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_StudentSkills').select('*, PYRUnibague_Skills(name)').eq('student_id',id).order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_StudentInterests').select('*').eq('student_id',id).order('sort_order').order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_StudentLocationPreferences').select('*, PYRUnibague_Municipalities(municipality_name)').eq('student_id',id).order('preference_order').order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_StudentDocuments').select('*').eq('student_id',id).order('created_at',{ascending:false}).order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_StudentPeriodParticipations').select('*, PYRUnibague_AcademicPeriods(name)').eq('student_id',id).order('created_at',{ascending:false}).order('id').range(a,b)),
  ]);check(profile.error)
  return {student:student.data!,profile:profile.data!,experiences,skills,interests,preferences,documents,participations}
}
export async function correctStudent(id:string,userId:string,form:FormData) {
  const semester=text(form,'semester');const value=semester?Number(semester):null
  if(value!==null&&(!Number.isInteger(value)||value<1))throw new FeatureError('Semestre inválido.')
  const db=await client()
  check((await db.from('PYRUnibague_Students').update({student_code:nullable(text(form,'code')),academic_program_id:nullable(text(form,'program')),current_semester:value,bio:nullable(text(form,'bio')),desired_work_description:nullable(text(form,'desired')),origin_municipality_id:nullable(text(form,'origin')),current_municipality_id:nullable(text(form,'current')),is_active:form.has('active')}).eq('id',id).select('id').single()).error)
  const profile=await db.from('PYRUnibague_UserProfiles').update({display_name:nullable(text(form,'name')),institutional_email:nullable(text(form,'email'))}).eq('user_id',userId).select('user_id').single()
  if(profile.error)throw new FeatureError('El perfil del estudiante se guardó; falló la identidad. Recarga y reintenta la corrección del nombre/correo.')
}
export async function saveParticipation(student:string,period:string,status:string,eligible:boolean) {
  if(!period||!status.trim())throw new FeatureError('Selecciona un periodo y escribe el estado.')
  const db=await client();check((await db.from('PYRUnibague_StudentPeriodParticipations').upsert({student_id:student,academic_period_id:period,status:status.trim(),eligible_for_matching:eligible},{onConflict:'student_id,academic_period_id'})).error)
}
export const organizationStates:Record<string,string>={pending:'Pendientes de revisión',pending_review:'Pendiente de revisión',submitted:'Enviada',changes_required:'Cambios solicitados',changes_requested:'Cambios solicitados',approved:'Aprobada',rejected:'Rechazada'}
export async function organizationCatalogs() {const db=await client();return allPages((a,b)=>db.from('PYRUnibague_OrganizationTypes').select('*').order('name').order('id').range(a,b))}
export async function listOrganizations(page:number,search:string,filters:{status:string;type:string;municipality:string;verified:string}) {
  const db=await client();let query=db.from('PYRUnibague_Organizations').select('*, PYRUnibague_OrganizationTypes(name), PYRUnibague_Municipalities(municipality_name), PYRUnibague_OrganizationDocuments(count)',{count:'exact'}).order('legal_name').order('id')
  const safe=search.replace(/[%_*(),.\\]/g,' ').trim();if(safe)query=query.or(`legal_name.ilike.%${safe}%,display_name.ilike.%${safe}%`)
  if(filters.status==='pending')query=query.in('status',['pending','pending_review','submitted'])
  else if(filters.status)query=query.eq('status',filters.status)
  if(filters.type)query=query.eq('organization_type_id',filters.type)
  if(filters.municipality)query=query.eq('municipality_id',filters.municipality)
  if(filters.verified==='true')query=query.not('verified_at','is',null)
  if(filters.verified==='false')query=query.is('verified_at',null)
  const result=await query.range(page*25,page*25+24);check(result.error)
  const ids=result.data?.map(row=>row.id)??[]
  const members=ids.length?await allPages((a,b)=>db.from('PYRUnibague_OrganizationMembers').select('*').in('organization_id',ids).eq('is_primary_contact',true).order('id').range(a,b)):[]
  const profiles=members.length?await db.from('PYRUnibague_UserProfiles').select('*').in('user_id',members.map(row=>row.user_id)):{data:[],error:null};check(profiles.error)
  return {rows:(result.data??[]).map(row=>({...row,contacts:members.filter(member=>member.organization_id===row.id).map(member=>profiles.data?.find(profile=>profile.user_id===member.user_id)?.display_name??member.user_id)})),count:result.count??0}
}
export async function organizationDetail(id:string) {
  const db=await client()
  const [organization,members,documents,reviews,projects,submissions]=await Promise.all([
    db.from('PYRUnibague_Organizations').select('*').eq('id',id).single(),
    allPages((a,b)=>db.from('PYRUnibague_OrganizationMembers').select('*').eq('organization_id',id).order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_OrganizationDocuments').select('*').eq('organization_id',id).order('created_at',{ascending:false}).order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_OrganizationReviews').select('*').eq('organization_id',id).order('created_at',{ascending:false}).order('id').range(a,b)),
    db.from('PYRUnibague_Projects').select('id,name,status',{count:'exact'}).eq('organization_id',id).order('created_at',{ascending:false}).order('id').range(0,24),
    db.from('PYRUnibague_AuditLogs').select('created_at,actor_user_id').eq('entity_id',id).eq('entity_table','PYRUnibague_Organizations').eq('action','ORGANIZATION_SUBMITTED').order('created_at',{ascending:false}).limit(1),
  ]);check(organization.error)
  check(projects.error)
  check(submissions.error)
  const profiles=members.length?await db.from('PYRUnibague_UserProfiles').select('*').in('user_id',members.map(row=>row.user_id)):{data:[],error:null};check(profiles.error)
  return {organization:organization.data!,members:members.map(row=>({...row,profile:profiles.data?.find(profile=>profile.user_id===row.user_id)})),documents,reviews,projects:projects.data??[],projectCount:projects.count??0,submittedAt:submissions.data?.[0]?.created_at??null}
}
export async function correctOrganization(id:string,form:FormData) {
  const name=text(form,'name'),website=text(form,'website');if(!name||!validUrl(website))throw new FeatureError('Revisa el nombre legal y la URL http/https.')
  const db=await client();check((await db.from('PYRUnibague_Organizations').update({legal_name:name,display_name:nullable(text(form,'display')),tax_id:nullable(text(form,'tax')),organization_type_id:nullable(text(form,'type')),municipality_id:nullable(text(form,'municipality')),description:nullable(text(form,'description')),website:nullable(website)}).eq('id',id).select('id').single()).error)
}
export async function reviewOrganization(id:string,decision:string,notes:string) {const db=await client();check((await db.rpc('pyr_unibague_review_organization',{p_organization_id:id,p_decision:decision,p_notes:nullable(notes)})).error)}
export async function dashboard() {
  const db=await client();const result=await db.rpc('pyr_unibague_admin_dashboard');check(result.error)
  const data=result.data
  if(!data||typeof data!=='object'||Array.isArray(data))throw new FeatureError('Respuesta administrativa inválida.')
  const metric=(key:string)=>{const value=data[key];if(typeof value!=='number')throw new FeatureError('Métrica administrativa inválida.');return value}
  const period=data.period;const periodName=period&&typeof period==='object'&&!Array.isArray(period)&&typeof period.name==='string'?period.name:null
  return {period:periodName,students:metric('students'),participating:metric('participating'),eligible:metric('eligible'),organizations:metric('organizations'),pendingOrganizations:metric('pendingOrganizations'),projects:metric('projects'),pendingProjects:metric('pendingProjects'),positions:metric('positions'),capacity:metric('capacity'),programs:metric('programs'),municipalities:metric('municipalities'),types:metric('types'),skills:metric('skills')}
}
export async function listUsers(page:number,search:string) {
  const db=await client();let query=db.from('PYRUnibague_UserProfiles').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('user_id')
  const safe=search.replace(/[%_*(),.\\]/g,' ').trim();if(safe)query=query.or(`display_name.ilike.%${safe}%,institutional_email.ilike.%${safe}%`)
  const result=await query.range(page*25,page*25+24);check(result.error)
  const ids=result.data?.map(row=>row.user_id)??[]
  const [roles,assignments]=await Promise.all([db.from('PYRUnibague_Roles').select('*').in('code',['ADMIN','ORGANIZATION','STUDENT']),ids.length?db.from('PYRUnibague_UserRoles').select('*').in('user_id',ids):Promise.resolve({data:[],error:null})]);check(roles.error);check(assignments.error)
  return {rows:(result.data??[]).map(row=>({...row,roles:(roles.data??[]).filter(role=>assignments.data?.some(item=>item.user_id===row.user_id&&item.role_id===role.id))})),catalog:roles.data??[],count:result.count??0}
}
export async function changeRole(user:string,role:string,assigned:boolean,actor:string) {
  const db=await client();const result=assigned?await db.from('PYRUnibague_UserRoles').upsert({user_id:user,role_id:role,assigned_by:actor},{onConflict:'user_id,role_id'}):await db.from('PYRUnibague_UserRoles').delete().eq('user_id',user).eq('role_id',role).select('id').single()
  if(result.error?.code==='23514')throw new FeatureError('No se puede retirar el último ADMIN del sistema.')
  check(result.error)
}
export type AuditFilters={actor:string;action:string;entity:string;from:string;to:string}
export async function listAudit(page:number,filters:AuditFilters) {
  const db=await client();let query=db.from('PYRUnibague_AuditLogs').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id')
  if(filters.actor)query=query.eq('actor_user_id',filters.actor)
  if(filters.action)query=query.eq('action',filters.action)
  if(filters.entity)query=query.eq('entity_table',filters.entity)
  if(filters.from)query=query.gte('created_at',new Date(filters.from+'T00:00:00-05:00').toISOString())
  if(filters.to)query=query.lt('created_at',new Date(new Date(filters.to+'T00:00:00-05:00').getTime()+86400000).toISOString())
  const result=await query.range(page*25,page*25+24);check(result.error)
  const ids=[...new Set((result.data??[]).flatMap(row=>row.actor_user_id?[row.actor_user_id]:[]))]
  const actors=ids.length?await db.from('PYRUnibague_UserProfiles').select('user_id,display_name').in('user_id',ids):{data:[],error:null};check(actors.error)
  return {rows:(result.data??[]).map(row=>({...row,actor:actors.data?.find(actor=>actor.user_id===row.actor_user_id)?.display_name??row.actor_user_id??'Sistema'})),count:result.count??0}
}
export function text(form:FormData,key:string){return String(form.get(key)??'').trim()}
export function parseJson(value:string):Json {try{return JSON.parse(value) as Json}catch{throw new FeatureError('Escribe JSON válido.')}}
