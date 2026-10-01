import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../src/lib/supabase/database.types.ts'
import type { Student, Position } from '../_shared/matching/engine.ts'
type Client = SupabaseClient<Database>
type Response<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
async function pages<T>(query: (from: number, to: number) => Response<T>): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(offset, offset + 499)
    if (error) throw new Error('POOL_READ_FAILED')
    rows.push(...(data ?? [])); if (!data || data.length < 500) return rows
  }
}
async function chunks<T>(ids: string[], query: (ids: string[], from: number, to: number) => Response<T>): Promise<T[]> {
  const result: T[] = []
  for (let start = 0; start < ids.length; start += 100) result.push(...await pages((from, to) => query(ids.slice(start, start + 100), from, to)))
  return result
}
function group<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>()
  for (const row of rows) { const id = key(row); const value = grouped.get(id) ?? []; value.push(row); grouped.set(id, value) }
  return (id: string) => grouped.get(id) ?? []
}
export async function loadPool(db: Client, period: string): Promise<{ students: Student[]; positions: Position[] }> {
  const [participations, projects] = await Promise.all([
    pages((from, to) => db.from('PYRUnibague_StudentPeriodParticipations').select('student_id').eq('academic_period_id', period).eq('eligible_for_matching', true).order('id').range(from, to)),
    pages((from, to) => db.from('PYRUnibague_Projects').select('id,name,summary,description,municipality_id').eq('academic_period_id', period).order('id').range(from, to)),
  ])
  const [students, positions] = await Promise.all([
    chunks(participations.map(p => p.student_id), (ids, from, to) => db.from('PYRUnibague_Students').select('id,academic_program_id,bio,desired_work_description,current_municipality_id,origin_municipality_id').in('id', ids).eq('is_active', true).order('id').range(from, to)),
    chunks(projects.map(p => p.id), (ids, from, to) => db.from('PYRUnibague_ProjectPositions').select('id,project_id,title,description').in('project_id', ids).eq('is_active', true).gt('capacity', 0).order('id').range(from, to)),
  ])
  const studentIds = students.map(s => s.id); const positionIds = positions.map(p => p.id)
  const [experiences, interests, studentSkills, preferences, programs, positionSkills, requirements] = await Promise.all([
    chunks(studentIds, (ids, from, to) => db.from('PYRUnibague_StudentExperiences').select('id,student_id,title,organization_name,description').in('student_id', ids).order('id').range(from, to)),
    chunks(studentIds, (ids, from, to) => db.from('PYRUnibague_StudentInterests').select('id,student_id,label,description').in('student_id', ids).order('id').range(from, to)),
    chunks(studentIds, (ids, from, to) => db.from('PYRUnibague_StudentSkills').select('id,student_id,skill_id,evidence_text').in('student_id', ids).order('id').range(from, to)),
    chunks(studentIds, (ids, from, to) => db.from('PYRUnibague_StudentLocationPreferences').select('id,student_id,municipality_id,preference_order').in('student_id', ids).order('id').range(from, to)),
    chunks(positionIds, (ids, from, to) => db.from('PYRUnibague_ProjectPositionPrograms').select('id,project_position_id,academic_program_id,is_required').in('project_position_id', ids).order('id').range(from, to)),
    chunks(positionIds, (ids, from, to) => db.from('PYRUnibague_ProjectPositionSkills').select('id,project_position_id,skill_id,is_required').in('project_position_id', ids).order('id').range(from, to)),
    chunks(positionIds, (ids, from, to) => db.from('PYRUnibague_ProjectRequirements').select('id,project_position_id,label,description').in('project_position_id', ids).order('id').range(from, to)),
  ])
  const skills = await chunks([...new Set([...studentSkills, ...positionSkills].map(s => s.skill_id))], (ids, from, to) => db.from('PYRUnibague_Skills').select('id,name').in('id', ids).order('id').range(from, to))
  const names = new Map(skills.map(s => [s.id, s.name])); const projectById = new Map(projects.map(p => [p.id, p]))
  const exp = group(experiences, r => r.student_id); const intr = group(interests, r => r.student_id); const ss = group(studentSkills, r => r.student_id); const pref = group(preferences, r => r.student_id)
  const prog = group(programs, r => r.project_position_id); const ps = group(positionSkills, r => r.project_position_id); const req = group(requirements, r => r.project_position_id)
  return {
    students: students.map(s => ({ ...s, experiences: exp(s.id), interests: intr(s.id), skills: ss(s.id).map(skill => ({ ...skill, name: names.get(skill.skill_id) ?? '' })), preferences: pref(s.id) })),
    positions: positions.map(p => { const project = projectById.get(p.project_id); if (!project) throw new Error('POOL_REFERENCE_MISSING'); return { ...p, project, programs: prog(p.id), skills: ps(p.id).map(skill => ({ ...skill, name: names.get(skill.skill_id) ?? '' })), requirements: req(p.id) } }),
  }
}
