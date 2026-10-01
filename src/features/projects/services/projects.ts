import { allPages, check, client, FeatureError } from '../../../lib/supabase/feature-helpers'
import type { Row } from '../../../lib/supabase/feature-helpers'
export type Project = Row<'PYRUnibague_Projects'>
export type Position = Row<'PYRUnibague_ProjectPositions'>
export const projectStates: Record<string,string> = { draft: 'Borrador', submitted: 'Enviado para revisión', changes_required: 'Cambios solicitados', approved: 'Aprobado', closed: 'Cerrado' }
export const projectStateLabel = (value: string) => projectStates[value] ?? value
export const editableState = (value: string) => ['draft','changes_required'].includes(value)
export function searchText(value: string) { return value.replace(/[%_*(),.\\]/g,' ').trim() }
export async function projectCatalogs() {
  const db = await client()
  const [periods,programs,skills,municipalities] = await Promise.all([
    allPages((a,b) => db.from('PYRUnibague_AcademicPeriods').select('*').order('starts_on',{ascending:false}).order('id').range(a,b)),
    allPages((a,b) => db.from('PYRUnibague_AcademicPrograms').select('*').order('name').order('id').range(a,b)),
    allPages((a,b) => db.from('PYRUnibague_Skills').select('*').order('name').order('id').range(a,b)),
    allPages((a,b) => db.from('PYRUnibague_Municipalities').select('*').order('municipality_name').order('id').range(a,b)),
  ])
  return {periods,programs,skills,municipalities}
}
export async function projectMemberships(userId: string) {
  const db = await client()
  const result = await db.from('PYRUnibague_OrganizationMembers').select('*, PYRUnibague_Organizations(*)').eq('user_id',userId).eq('status','active').order('id')
  check(result.error); return result.data ?? []
}
export async function listProjects(page: number, search: string, filters: {organization?: string; period?: string; status?: string; municipality?: string; modality?: string} = {}) {
  const db = await client()
  let query = db.from('PYRUnibague_Projects').select('*, PYRUnibague_Organizations(legal_name), PYRUnibague_AcademicPeriods(name), PYRUnibague_Municipalities(municipality_name), PYRUnibague_ProjectPositions(count)',{count:'exact'}).order('created_at',{ascending:false}).order('id')
  if (filters.organization) query=query.eq('organization_id',filters.organization)
  if (filters.period) query=query.eq('academic_period_id',filters.period)
  if (filters.status) query=query.eq('status',filters.status)
  if (filters.municipality) query=query.eq('municipality_id',filters.municipality)
  if (filters.modality) query=query.ilike('modality','%'+searchText(filters.modality)+'%')
  if (searchText(search)) query=query.ilike('name','%'+searchText(search)+'%')
  const result=await query.range(page*25,page*25+24); check(result.error)
  // One aggregate per page, no query per project and no REST row-limit undercount.
  const totals = result.data?.length ? await db.rpc('pyr_unibague_project_totals',{p_project_ids:result.data.map(row=>row.id)}) : {data:[],error:null}
  check(totals.error)
  return {rows:(result.data??[]).map(row=>({...row,capacity:totals.data?.find(total=>total.project_id===row.id)?.total_capacity??0})),count:result.count??0}
}
export async function projectDetail(id: string, page=0) {
  const db=await client()
  const [project,positions]=await Promise.all([
    db.from('PYRUnibague_Projects').select('*, PYRUnibague_Organizations(legal_name)').eq('id',id).single(),
    db.from('PYRUnibague_ProjectPositions').select('*',{count:'exact'}).eq('project_id',id).order('created_at').order('id').range(page*25,page*25+24),
  ])
  check(project.error);check(positions.error)
  const ids=(positions.data??[]).map(row=>row.id)
  const [programs,skills,requirements]=ids.length? await Promise.all([
    allPages((a,b)=>db.from('PYRUnibague_ProjectPositionPrograms').select('*').in('project_position_id',ids).order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_ProjectPositionSkills').select('*').in('project_position_id',ids).order('id').range(a,b)),
    allPages((a,b)=>db.from('PYRUnibague_ProjectRequirements').select('*').in('project_position_id',ids).order('sort_order').order('id').range(a,b)),
  ]):[[],[],[]]
  return {project:project.data!,positions:positions.data??[],count:positions.count??0,programs,skills,requirements}
}
export type ProjectDetail = Awaited<ReturnType<typeof projectDetail>>
export type ProjectEdit = Pick<Project,'name'|'summary'|'description'|'academic_period_id'|'municipality_id'|'modality'>
export async function saveProject(id: string|null, organization: string, user: string, fields: ProjectEdit) {
  if (!fields.name.trim() || !fields.academic_period_id) throw new FeatureError('Nombre y periodo son obligatorios.')
  const edit: ProjectEdit={name:fields.name.trim(),summary:fields.summary,description:fields.description,academic_period_id:fields.academic_period_id,municipality_id:fields.municipality_id,modality:fields.modality}
  const db=await client()
  const result=id ? await db.from('PYRUnibague_Projects').update(edit).eq('id',id).select('id').single() : await db.from('PYRUnibague_Projects').insert({...edit,organization_id:organization,created_by:user,status:'draft'}).select('id').single()
  check(result.error);return result.data!.id
}
export async function changeProjectState(id: string,status: string) {
  if (!Object.hasOwn(projectStates,status)) throw new FeatureError('Estado de proyecto inválido.')
  const db=await client();check((await db.from('PYRUnibague_Projects').update({status}).eq('id',id).select('id').single()).error)
}
export async function savePosition(id: string|null,project: string,fields: Pick<Position,'title'|'description'|'capacity'|'status'|'is_active'>) {
  if (!Number.isInteger(fields.capacity) || fields.capacity<1 || fields.capacity>2147483647) throw new FeatureError('La capacidad debe ser un entero positivo.')
  if (!fields.title.trim() || !fields.status.trim()) throw new FeatureError('Título y estado de plaza son obligatorios.')
  const edit={title:fields.title.trim(),description:fields.description,capacity:fields.capacity,status:fields.status.trim(),is_active:fields.is_active}
  const db=await client();const result=id?await db.from('PYRUnibague_ProjectPositions').update(edit).eq('id',id).select('id').single():await db.from('PYRUnibague_ProjectPositions').insert({...edit,project_id:project}).select('id').single();check(result.error)
}
export async function savePositionProgram(position: string,program: string,required: boolean) {const db=await client();check((await db.from('PYRUnibague_ProjectPositionPrograms').upsert({project_position_id:position,academic_program_id:program,is_required:required},{onConflict:'project_position_id,academic_program_id'})).error)}
export async function savePositionSkill(position: string,skill: string,required: boolean) {const db=await client();check((await db.from('PYRUnibague_ProjectPositionSkills').upsert({project_position_id:position,skill_id:skill,is_required:required},{onConflict:'project_position_id,skill_id'})).error)}
export async function saveRequirement(id: string|null,position: string,fields: {label:string;description:string|null;is_mandatory:boolean;sort_order:number}) {
  if (!fields.label.trim() || !Number.isInteger(fields.sort_order) || fields.sort_order<0) throw new FeatureError('Escribe un requisito y un orden válido.')
  const edit={label:fields.label.trim(),description:fields.description,is_mandatory:fields.is_mandatory,sort_order:fields.sort_order}; const db=await client()
  check((id?await db.from('PYRUnibague_ProjectRequirements').update(edit).eq('id',id).select('id').single():await db.from('PYRUnibague_ProjectRequirements').insert({...edit,project_position_id:position})).error)
}
export async function removeProjectPart(table: 'PYRUnibague_ProjectPositions'|'PYRUnibague_ProjectPositionPrograms'|'PYRUnibague_ProjectPositionSkills'|'PYRUnibague_ProjectRequirements',id: string) {const db=await client();check((await db.from(table).delete().eq('id',id).select('id').single()).error)}
