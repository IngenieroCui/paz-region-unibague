import { allPages, check, client, FeatureError } from '../../../lib/supabase/feature-helpers'
import type { Row, Insert, Update } from '../../../lib/supabase/feature-helpers'

export type Student = Row<'PYRUnibague_Students'>
export function participationLabel(status: string) {
  const labels: Record<string, string> = { active: 'Activa', inactive: 'Inactiva', registered: 'Registrada', reviewed: 'Revisada', pending: 'Pendiente', completed: 'Completada', withdrawn: 'Retirada', test: 'Prueba' }
  return labels[status] ?? status
}
export type StudentEdit = Pick<Student, 'student_code' | 'academic_program_id' | 'current_semester' | 'bio' | 'desired_work_description' | 'origin_municipality_id' | 'current_municipality_id' | 'profile_links'>
export type ExperienceEdit = Pick<Row<'PYRUnibague_StudentExperiences'>, 'title' | 'organization_name' | 'description' | 'started_on' | 'ended_on' | 'is_current'>
export async function loadStudent(userId: string) {
  const db = await client()
  const results = await Promise.all([
    db.from('PYRUnibague_UserProfiles').select('*').eq('user_id', userId).single(),
    db.from('PYRUnibague_Students').select('*').eq('user_id', userId).maybeSingle(),
    db.from('PYRUnibague_AcademicPrograms').select('*').order('name'),
    allPages((from, to) => db.from('PYRUnibague_Municipalities').select('*').order('municipality_name').order('id').range(from, to)).then(data => ({ data, error: null })),
    db.from('PYRUnibague_Skills').select('*').order('name'),
    db.from('PYRUnibague_AcademicPeriods').select('*').eq('is_current', true).maybeSingle(),
  ])
  results.forEach(result => check(result.error))
  const [profile, student, programs, municipalities, skills, period] = results
  let extras = { experiences: [] as Row<'PYRUnibague_StudentExperiences'>[], studentSkills: [] as Row<'PYRUnibague_StudentSkills'>[], interests: [] as Row<'PYRUnibague_StudentInterests'>[], preferences: [] as Row<'PYRUnibague_StudentLocationPreferences'>[], documents: [] as Row<'PYRUnibague_StudentDocuments'>[], participation: null as Row<'PYRUnibague_StudentPeriodParticipations'> | null }
  if (student.data) {
    const id = student.data.id
    const children = await Promise.all([
      db.from('PYRUnibague_StudentExperiences').select('*').eq('student_id', id).order('started_on', { ascending: false }),
      db.from('PYRUnibague_StudentSkills').select('*').eq('student_id', id),
      db.from('PYRUnibague_StudentInterests').select('*').eq('student_id', id).order('sort_order').order('id'),
      db.from('PYRUnibague_StudentLocationPreferences').select('*').eq('student_id', id).order('preference_order'),
      db.from('PYRUnibague_StudentDocuments').select('*').eq('student_id', id).order('created_at', { ascending: false }),
      db.from('PYRUnibague_StudentPeriodParticipations').select('*').eq('student_id', id),
    ])
    children.forEach(result => check(result.error))
    extras = { experiences: children[0].data ?? [], studentSkills: children[1].data ?? [], interests: children[2].data ?? [], preferences: children[3].data ?? [], documents: children[4].data ?? [], participation: children[5].data?.find(row => row.academic_period_id === period.data?.id) ?? null }
  }
  return { profile: profile.data, student: student.data, programs: programs.data ?? [], municipalities: municipalities.data ?? [], skills: skills.data ?? [], period: period.data, ...extras }
}
export type StudentData = Awaited<ReturnType<typeof loadStudent>>
export async function saveStudent(userId: string, id: string | undefined, displayName: string, fields: StudentEdit) {
  const db = await client()
  // Pick fields explicitly: callers cannot smuggle institutional or ownership columns.
  const edit: StudentEdit = { student_code: fields.student_code, academic_program_id: fields.academic_program_id, current_semester: fields.current_semester, bio: fields.bio, desired_work_description: fields.desired_work_description, origin_municipality_id: fields.origin_municipality_id, current_municipality_id: fields.current_municipality_id, profile_links: fields.profile_links }
  const result = id ? await db.from('PYRUnibague_Students').update(edit).eq('id', id).eq('user_id', userId).select('id').single() : await db.from('PYRUnibague_Students').insert({ ...edit, user_id: userId }).select('id').single()
  check(result.error)
  const profile = await db.from('PYRUnibague_UserProfiles').update({ display_name: displayName || null }).eq('user_id', userId).select('user_id').single()
  if (profile.error) throw new FeatureError('El perfil profesional se guardó, pero el nombre visible no. Recarga y vuelve a guardar el nombre.', 'partial')
}
export function validateExperience(fields: ExperienceEdit) {
  if (!fields.title.trim()) throw new FeatureError('Escribe el título de la experiencia.')
  for (const date of [fields.started_on, fields.ended_on]) if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new FeatureError('Revisa las fechas de la experiencia.')
  if (fields.is_current && fields.ended_on) throw new FeatureError('Una experiencia actual no tiene fecha de finalización.')
  if (fields.started_on && fields.ended_on && fields.ended_on < fields.started_on) throw new FeatureError('La fecha final debe ser posterior o igual a la inicial.')
}
export async function saveExperience(studentId: string, fields: ExperienceEdit, id?: string) {
  validateExperience(fields); const db = await client()
  const edit: ExperienceEdit = { title: fields.title.trim(), organization_name: fields.organization_name, description: fields.description, started_on: fields.started_on, ended_on: fields.ended_on, is_current: fields.is_current }
  check((id ? await db.from('PYRUnibague_StudentExperiences').update(edit).eq('student_id', studentId).eq('id', id).select('id').single() : await db.from('PYRUnibague_StudentExperiences').insert({ ...edit, student_id: studentId }).select('id').single()).error)
}
type ChildTable = 'PYRUnibague_StudentExperiences' | 'PYRUnibague_StudentSkills' | 'PYRUnibague_StudentInterests'
export async function deleteStudentChild(table: ChildTable, studentId: string, id: string) { const db = await client(); check((await db.from(table).delete().eq('student_id', studentId).eq('id', id).select('id').single()).error) }
export async function saveSkill(studentId: string, skillId: string, evidence: string, id?: string) {
  const db = await client()
  check((id ? await db.from('PYRUnibague_StudentSkills').update({ evidence_text: evidence || null }).eq('id', id).eq('student_id', studentId).select('id').single() : await db.from('PYRUnibague_StudentSkills').insert({ student_id: studentId, skill_id: skillId, evidence_text: evidence || null }).select('id').single()).error)
}
export async function saveInterest(studentId: string, label: string, description: string, sortOrder: number, id?: string) {
  if (!label.trim()) throw new FeatureError('Escribe un interés.')
  const db = await client()
  const fields: Update<'PYRUnibague_StudentInterests'> = { label: label.trim(), description: description || null }
  const create: Insert<'PYRUnibague_StudentInterests'> = { ...fields, label: label.trim(), student_id: studentId, sort_order: sortOrder }
  check((id ? await db.from('PYRUnibague_StudentInterests').update(fields).eq('student_id', studentId).eq('id', id).select('id').single() : await db.from('PYRUnibague_StudentInterests').insert(create).select('id').single()).error)
}
export async function orderInterests(studentId: string, ids: string[]) { const db = await client(); check((await db.rpc('pyr_unibague_order_student_interests', { p_student_id: studentId, p_ids: ids })).error) }
export async function setPreferences(studentId: string, municipalityIds: string[]) {
  if (new Set(municipalityIds).size !== municipalityIds.length) throw new FeatureError('No puedes repetir municipios.')
  const db = await client(); check((await db.rpc('pyr_unibague_set_student_preferences', { p_student_id: studentId, p_municipality_ids: municipalityIds })).error)
}
