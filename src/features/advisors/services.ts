import { allPages, check, client, FeatureError, nullable } from '../../lib/supabase/feature-helpers'
import type { Insert, Row } from '../../lib/supabase/feature-helpers'
import type { Json } from '../../lib/supabase/database.types'

export type Staff = Row<'PYRUnibague_StaffProfiles'>
export type SpecialCase = Row<'PYRUnibague_StudentSpecialCases'>
async function adminClient() {
  const db = await client()
  const result = await db.rpc('pyr_unibague_current_roles'); check(result.error)
  if (!result.data?.includes('ADMIN')) throw new FeatureError('Se requiere el rol ADMIN.', '42501')
  return db
}
export async function loadPeriods() {
  const db = await client()
  return allPages((from, to) => db.from('PYRUnibague_AcademicPeriods').select('*').order('created_at', { ascending: false }).order('id').range(from, to))
}
export async function loadAdminAdvisors(period: string) {
  const db = await adminClient()
  const [staff, profiles, roles, userRoles, organizations, students, municipalities, participations, organizationHistory, studentHistory, cases, assignments] = await Promise.all([
    allPages((f,t) => db.from('PYRUnibague_StaffProfiles').select('*').order('id').range(f,t)),
    allPages((f,t) => db.from('PYRUnibague_UserProfiles').select('user_id,display_name,institutional_email').order('user_id').range(f,t)),
    allPages((f,t) => db.from('PYRUnibague_Roles').select('id,code').eq('code','ADVISOR').order('id').range(f,t)),
    allPages((f,t) => db.from('PYRUnibague_UserRoles').select('user_id,role_id').order('id').range(f,t)),
    allPages((f,t) => db.from('PYRUnibague_Organizations').select('id,legal_name,display_name').order('legal_name').order('id').range(f,t)),
    allPages((f,t) => db.from('PYRUnibague_Students').select('id,user_id,student_code').order('id').range(f,t)),
    allPages((f,t) => db.from('PYRUnibague_Municipalities').select('id,municipality_name,department_name').order('municipality_name').order('id').range(f,t)),
    period ? allPages((f,t) => db.from('PYRUnibague_StudentPeriodParticipations').select('*').eq('academic_period_id',period).order('id').range(f,t)) : [],
    period ? allPages((f,t) => db.from('PYRUnibague_AdvisorOrganizationAssignments').select('*').eq('academic_period_id',period).order('created_at',{ascending:false}).order('id').range(f,t)) : [],
    // ADMIN can read history; filter by selected participations after the batch completes.
    allPages((f,t) => db.from('PYRUnibague_AdvisorStudentAssignments').select('*').order('created_at',{ascending:false}).order('id').range(f,t)),
    allPages((f,t) => db.from('PYRUnibague_StudentSpecialCases').select('*').order('created_at',{ascending:false}).order('id').range(f,t)),
    period ? allPages((f,t) => db.from('PYRUnibague_Assignments').select('id,student_id,academic_period_id,is_active').eq('academic_period_id',period).order('id').range(f,t)) : [],
  ])
  const participationIds = new Set(participations.map(row => row.id))
  const advisorRoleIds = new Set(roles.map(row => row.id))
  const advisorUsers = new Set(userRoles.filter(row => advisorRoleIds.has(row.role_id)).map(row => row.user_id))
  return { staff, profiles, advisorUsers, organizations, students, municipalities, participations, organizationHistory,
    studentHistory: studentHistory.filter(row => participationIds.has(row.participation_id)), cases: cases.filter(row => participationIds.has(row.participation_id)), assignments }
}
export type AdminAdvisorData = Awaited<ReturnType<typeof loadAdminAdvisors>>
export async function saveStaff(draft: Pick<Insert<'PYRUnibague_StaffProfiles'>,'user_id'|'staff_code'|'phone'|'academic_unit'|'status'>, id?: string) {
  const db = await adminClient()
  const payload = { staff_code: nullable(draft.staff_code ?? ''), phone: nullable(draft.phone ?? ''), academic_unit: nullable(draft.academic_unit ?? ''), status: draft.status }
  const result = id ? await db.from('PYRUnibague_StaffProfiles').update(payload).eq('id',id).select('id').single()
    : await db.from('PYRUnibague_StaffProfiles').insert({ ...payload, user_id: draft.user_id }).select('id').single()
  check(result.error)
}
export async function changeOrganizationAdvisor(organization: string, period: string, advisor: string | null, starts: string) {
  const db = await adminClient()
  const result = await db.rpc('pyr_unibague_change_organization_advisor', { p_organization_id: organization, p_academic_period_id: period, p_advisor_id: advisor, p_starts_on: starts })
  check(result.error); return result.data
}
export async function changeStudentAdvisor(participation: string, advisor: string | null, starts: string, reason: string, source: string | null) {
  const db = await adminClient()
  const result = await db.rpc('pyr_unibague_change_student_advisor', { p_participation_id: participation, p_advisor_id: advisor, p_starts_on: starts, p_reason: nullable(reason), p_source_assignment_id: source })
  check(result.error); return result.data
}
export async function saveSpecialCase(draft: Pick<Insert<'PYRUnibague_StudentSpecialCases'>,'participation_id'|'case_type_code'|'requested_municipality_id'|'status'|'decision_notes'>, id?: string) {
  const db = await adminClient()
  const result = id ? await db.from('PYRUnibague_StudentSpecialCases').update(draft).eq('id',id).select('id').single()
    : await db.from('PYRUnibague_StudentSpecialCases').insert(draft).select('id').single()
  check(result.error)
}
export async function saveArl(participation: string, provider: string) {
  const db = await adminClient()
  const result = await db.from('PYRUnibague_StudentPeriodParticipations').update({ arl_provider_name: nullable(provider) }).eq('id',participation).select('id').single()
  check(result.error)
}

// Validate the projection at the boundary instead of trusting a JSON type assertion.
type ObjectValue = { [key: string]: Json | undefined }
function object(value: Json | undefined): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FeatureError('Respuesta de asesoría incompleta.')
  return value
}
function array(value: Json | undefined) {
  if (!Array.isArray(value)) throw new FeatureError('Respuesta de asesoría incompleta.')
  return value.map(object)
}
function string(value: Json | undefined) {
  if (typeof value !== 'string') throw new FeatureError('Respuesta de asesoría incompleta.')
  return value
}
function optional(value: Json | undefined) { return value === null ? null : string(value) }
function contact(value: ObjectValue) {
  if (typeof value.is_primary !== 'boolean') throw new FeatureError('Respuesta de asesoría incompleta.')
  return { id: string(value.id), full_name: string(value.full_name), position_title: optional(value.position_title), email: optional(value.email), phone: optional(value.phone), is_primary: value.is_primary }
}
export function parseAdvisorWorkspace(value: Json) {
  const data = object(value)
  return {
    organizations: array(data.organizations).map(row => ({ id: string(row.id), name: string(row.name), description: optional(row.description), starts_on: string(row.starts_on), contacts: array(row.contacts).map(contact) })),
    students: array(data.students).map(row => {
      if (row.semester !== null && (typeof row.semester !== 'number' || !Number.isInteger(row.semester))) throw new FeatureError('Respuesta de asesoría incompleta.')
      return { participation_id: string(row.participation_id), name: string(row.name), program: optional(row.program), semester: row.semester, bio: optional(row.bio), desired_work_description: optional(row.desired_work_description), starts_on: string(row.starts_on),
        experiences: array(row.experiences).map(e => ({ id: string(e.id), title: string(e.title), organization_name: optional(e.organization_name), description: optional(e.description), started_on: optional(e.started_on), ended_on: optional(e.ended_on) })),
        skills: array(row.skills).map(s => ({ id: string(s.id), name: string(s.name), evidence_text: optional(s.evidence_text) })),
        interests: array(row.interests).map(i => ({ id: string(i.id), label: string(i.label), description: optional(i.description) })) }
    }),
    projects: array(data.projects).map(row => ({ id: string(row.id), name: string(row.name), summary: optional(row.summary), description: optional(row.description), organization_id: string(row.organization_id), organization_name: string(row.organization_name), modality: optional(row.modality), municipality: optional(row.municipality), interlocutors: array(row.interlocutors).map(contact) })),
  }
}
export type AdvisorData = ReturnType<typeof parseAdvisorWorkspace>
export async function loadAdvisorWorkspace(period: string) {
  if (!period) return { organizations: [], students: [], projects: [] } satisfies AdvisorData
  const db = await client()
  const result = await db.rpc('pyr_unibague_advisor_workspace', { p_academic_period_id: period }); check(result.error)
  return parseAdvisorWorkspace(result.data)
}
export async function loadAdvisorProfile() {
  const db = await client()
  const identity = await db.auth.getUser(); check(identity.error)
  if (!identity.data.user) throw new FeatureError('Inicia sesión nuevamente.')
  const [staff, profile] = await Promise.all([
    db.from('PYRUnibague_StaffProfiles').select('*').eq('user_id',identity.data.user.id).maybeSingle(),
    db.from('PYRUnibague_UserProfiles').select('display_name,institutional_email').eq('user_id',identity.data.user.id).single(),
  ])
  check(staff.error); check(profile.error)
  return { staff: staff.data, profile: profile.data }
}
