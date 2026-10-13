import type { SupabaseClient } from '@supabase/supabase-js'
import { allPages, check, client, FeatureError } from '../../../lib/supabase/feature-helpers'
import type { Database } from '../../../lib/supabase/database.types'
import { readProjectTeam } from '../../groups'
import type { ProjectTeam } from '../../groups'

export type ZoneType = 'rural' | 'urban' | null
type ProjectTable = Database['public']['Tables']['PYRUnibague_Projects']
/** Temporary feature-local contract; regenerate shared types after integration of 009. */
type ProjectDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Omit<Database['public']['Tables'], 'PYRUnibague_Projects'> & {
      PYRUnibague_Projects: Omit<ProjectTable, 'Row' | 'Insert' | 'Update'> & {
        Row: ProjectTable['Row'] & { zone_type: ZoneType }
        Insert: ProjectTable['Insert'] & { zone_type?: ZoneType }
        Update: ProjectTable['Update'] & { zone_type?: ZoneType }
      }
    }
  }
}
export async function projectClient() {
  // The same authenticated singleton, with only the feature-owned schema extension.
  return await client() as unknown as SupabaseClient<ProjectDatabase>
}
export function zoneLabel(value: ZoneType | undefined) {
  return value === 'rural' ? 'Rural' : value === 'urban' ? 'Urbana' : 'Sin registrar'
}
export function parseZoneType(value: string): ZoneType {
  if (!value) return null
  if (value === 'rural' || value === 'urban') return value
  throw new FeatureError('Zona de proyecto inválida.')
}
export interface InstitutionalPerson {
  id: string
  displayName: string | null
}
export interface InstitutionalRelations {
  availability: 'available' | 'not_integrated'
  interlocutors: InstitutionalPerson[]
  advisors: InstitutionalPerson[]
}
/** Agent A supplies a reader backed by ProjectInterlocutors / AdvisorOrganizationAssignments. */
export type InstitutionalReader = (project: {
  id: string; organization_id: string; academic_period_id: string
}) => Promise<InstitutionalRelations>
export const unavailableInstitutionalReader: InstitutionalReader = async () => ({
  availability: 'not_integrated', interlocutors: [], advisors: [],
})
export async function institutionalSheet(projectId: string, readPeople = unavailableInstitutionalReader) {
  const db = await projectClient()
  const result = await db.from('PYRUnibague_Projects')
    .select('*, PYRUnibague_Organizations(legal_name, website), PYRUnibague_AcademicPeriods(name, code), PYRUnibague_Municipalities(municipality_name, department_name)')
    .eq('id', projectId).single()
  check(result.error)
  const project = result.data!
  const [positions, people] = await Promise.all([
    allPages((from, to) => db.from('PYRUnibague_ProjectPositions').select('*')
      .eq('project_id', projectId).order('created_at').order('id').range(from, to)),
    readPeople(project),
  ])
  const programs: { project_position_id: string; PYRUnibague_AcademicPrograms: { name: string } | null }[] = []
  for (let offset = 0; offset < positions.length; offset += 100) {
    programs.push(...await allPages((from, to) => db.from('PYRUnibague_ProjectPositionPrograms')
      .select('project_position_id, PYRUnibague_AcademicPrograms(name)')
      .in('project_position_id', positions.slice(offset, offset + 100).map(position => position.id)).order('id').range(from, to)))
  }
  return { project, positions, programs, people }
}
export type InstitutionalSheetData = Awaited<ReturnType<typeof institutionalSheet>> & { team?: ProjectTeam }
export async function completeInstitutionalSheet(projectId: string, readPeople = unavailableInstitutionalReader): Promise<InstitutionalSheetData> {
  const [sheet,team] = await Promise.all([institutionalSheet(projectId,readPeople),readProjectTeam(projectId)])
  return { ...sheet,team }
}
