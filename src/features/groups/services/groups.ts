import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../../lib/supabase/database.types'
import { check, client, FeatureError } from '../../../lib/supabase/feature-helpers'
export interface Group { id: string; project_id: string; name: string; status: 'active' | 'closed'; started_on: string | null; created_at: string; updated_at: string }
export interface GroupMember { id: string; group_id: string; assignment_id: string; joined_on: string | null; left_on: string | null; status: 'active' | 'inactive'; created_at: string; updated_at: string }
export interface TeamAssignment { id: string; student_id: string; display_name: string | null; program_name: string | null; position_title: string; is_active: boolean; status: string; unassigned_at: string | null }
export interface ProjectTeam { groups: Group[]; members: GroupMember[]; assignments: TeamAssignment[] }
type Table<T, Required extends keyof T> = { Row: { [K in keyof T]: T[K] }; Insert: Pick<T, Required> & Partial<T>; Update: Partial<T>; Relationships: [] }
type GroupsDatabase = Omit<Database,'public'> & { public: Omit<Database['public'],'Tables' | 'Functions'> & {
  Tables: Database['public']['Tables'] & { PYRUnibague_Groups: Table<Group,'project_id' | 'name'>; PYRUnibague_GroupMembers: Table<GroupMember,'group_id' | 'assignment_id'> }
  Functions: Database['public']['Functions'] & { pyr_unibague_project_team: { Args: { p_project_id: string }; Returns: Json } }
} }
async function groupClient() { return await client() as unknown as SupabaseClient<GroupsDatabase> }
function record(value: unknown): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FeatureError('Respuesta de equipos inválida.')
  return value as Record<string,unknown>
}
function string(value: unknown): string { if (typeof value !== 'string') throw new FeatureError('Respuesta de equipos inválida.'); return value }
function nullableString(value: unknown): string | null { return value === null ? null : string(value) }
function list(value: unknown): unknown[] { if (!Array.isArray(value)) throw new FeatureError('Respuesta de equipos inválida.'); return value }
export function parseProjectTeam(value: unknown): ProjectTeam {
  const data = record(value)
  return {
    groups: list(data.groups).map(value => {
      const row = record(value), status = string(row.status)
      if (status !== 'active' && status !== 'closed') throw new FeatureError('Estado de equipo inválido.')
      return { id:string(row.id), project_id:string(row.project_id), name:string(row.name), status, started_on:nullableString(row.started_on), created_at:string(row.created_at), updated_at:string(row.updated_at) }
    }),
    members: list(data.members).map(value => {
      const row = record(value), status = string(row.status)
      if (status !== 'active' && status !== 'inactive') throw new FeatureError('Estado de integrante inválido.')
      return { id:string(row.id),group_id:string(row.group_id),assignment_id:string(row.assignment_id),joined_on:nullableString(row.joined_on),left_on:nullableString(row.left_on),status,created_at:string(row.created_at),updated_at:string(row.updated_at) }
    }),
    assignments: list(data.assignments).map(value => {
      const row = record(value)
      if (typeof row.is_active !== 'boolean') throw new FeatureError('Respuesta de asignaciones inválida.')
      return { id:string(row.id),student_id:string(row.student_id),display_name:nullableString(row.display_name),program_name:nullableString(row.program_name),position_title:string(row.position_title),is_active:row.is_active,status:string(row.status),unassigned_at:nullableString(row.unassigned_at) }
    }),
  }
}
export async function readProjectTeam(project: string) {
  const db = await groupClient(); const result = await db.rpc('pyr_unibague_project_team',{ p_project_id:project }); check(result.error)
  return parseProjectTeam(result.data)
}
export async function groupAccess(project: string, user: string, admin: boolean) {
  const db = await groupClient()
  const result = await db.from('PYRUnibague_Projects').select('id, name, organization_id').eq('id',project).single(); check(result.error)
  if (admin) return { project:result.data!,canManage:true }
  const member = await db.from('PYRUnibague_OrganizationMembers').select('can_manage').eq('organization_id',result.data!.organization_id).eq('user_id',user).eq('status','active').single(); check(member.error)
  return { project:result.data!,canManage:member.data!.can_manage }
}
export async function saveGroup(id: string | null, project: string, fields: Pick<Group,'name' | 'status' | 'started_on'>) {
  if (!fields.name.trim() || fields.name.trim().length > 240 || !['active','closed'].includes(fields.status)) throw new FeatureError('Nombre y estado de equipo válidos son obligatorios.')
  if (fields.started_on && !validDate(fields.started_on)) throw new FeatureError('Fecha de inicio inválida.')
  const edit = { name:fields.name.trim(),status:fields.status,started_on:fields.started_on }
  const db = await groupClient()
  const result = id ? await db.from('PYRUnibague_Groups').update(edit).eq('id',id).eq('project_id',project).select('id').single() : await db.from('PYRUnibague_Groups').insert({ ...edit,project_id:project }).select('id').single()
  check(result.error)
}
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value }
export function availableAssignments(team: ProjectTeam) {
  const linked = new Set(team.members.filter(member => member.status === 'active').map(member => member.assignment_id))
  return team.assignments.filter(row => row.is_active && row.status === 'confirmed' && row.unassigned_at === null && !linked.has(row.id))
}
export async function addGroupMember(group: Group, assignment: TeamAssignment, joinedOn: string | null) {
  if (group.status !== 'active' || !assignment.is_active || assignment.status !== 'confirmed' || assignment.unassigned_at !== null) throw new FeatureError('Solo puedes incorporar asignaciones confirmadas a un equipo activo.')
  if (joinedOn && !validDate(joinedOn)) throw new FeatureError('Fecha de ingreso inválida.')
  const db = await groupClient(); check((await db.from('PYRUnibague_GroupMembers').insert({ group_id:group.id,assignment_id:assignment.id,joined_on:joinedOn,status:'active' }).select('id').single()).error)
}
export async function retireGroupMember(member: GroupMember, leftOn: string) {
  if (member.status !== 'active' || !validDate(leftOn) || (member.joined_on && leftOn < member.joined_on)) throw new FeatureError('La salida debe ser posterior al ingreso.')
  const db = await groupClient(); check((await db.from('PYRUnibague_GroupMembers').update({ status:'inactive',left_on:leftOn }).eq('id',member.id).eq('status','active').select('id').single()).error)
}
export function bogotaToday() { return new Intl.DateTimeFormat('sv-SE',{ timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date()) }
