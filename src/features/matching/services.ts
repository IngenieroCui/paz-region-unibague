import { allPages, check, client, FeatureError } from '../../lib/supabase/feature-helpers'
import type { Row } from '../../lib/supabase/feature-helpers'
import type { Json } from '../../lib/supabase/database.types'
import { COMPONENTS, validateConfiguration } from '../../../supabase/functions/_shared/matching/engine'
import type { Configuration, ComponentScore, Component } from '../../../supabase/functions/_shared/matching/engine'
export { COMPONENTS }
export type { Configuration, ComponentScore }
export type ConfigRow = Row<'PYRUnibague_MatchingConfigurations'>
export type RunRow = Row<'PYRUnibague_MatchingRuns'>
export type CandidateRow = Row<'PYRUnibague_MatchCandidates'>
export const PAGE_SIZE = 25
export function jsonObject(value: Json | undefined): { [key: string]: Json | undefined } {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
export function runThreshold(run: RunRow): number | null {
  const score = jsonObject(jsonObject(run.summary).configuration_snapshot).minimum_recommended_score
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100 ? score : null
}
export function candidateComponents(candidate: CandidateRow): [Component, ComponentScore][] {
  const scores = jsonObject(candidate.component_scores)
  return COMPONENTS.map(key => {
    const value = jsonObject(scores[key])
    return [key, { raw_score: typeof value.raw_score === 'number' ? value.raw_score : null, configured_weight: typeof value.configured_weight === 'number' ? value.configured_weight : 0, effective_weight: typeof value.effective_weight === 'number' ? value.effective_weight : 0, available: value.available === true }]
  })
}
export function jsonEntries(value: Json) { return Array.isArray(value) ? value.map(jsonObject) : [] }
async function adminClient() {
  const db = await client(); const roles = await db.rpc('pyr_unibague_current_roles'); check(roles.error)
  if (!roles.data?.includes('ADMIN')) throw new FeatureError('Matching requiere el rol ADMIN.', '42501')
  return db
}
export async function loadMatchingMetadata() {
  const db = await adminClient()
  const [periods, configurations] = await Promise.all([
    allPages((from, to) => db.from('PYRUnibague_AcademicPeriods').select('*').order('created_at', { ascending: false }).order('id').range(from, to)),
    allPages((from, to) => db.from('PYRUnibague_MatchingConfigurations').select('*').order('created_at', { ascending: false }).order('id').range(from, to)),
  ])
  return { periods, configurations }
}
export async function loadRuns(period: string, page: number) {
  const db = await client()
  const result = await db.from('PYRUnibague_MatchingRuns').select('*', { count: 'exact' }).eq('academic_period_id', period).order('created_at', { ascending: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  check(result.error); return { rows: result.data ?? [], count: result.count ?? 0 }
}
export async function configurationUsed(id: string) {
  const db = await client(); const result = await db.from('PYRUnibague_MatchingRuns').select('id', { head: true, count: 'exact' }).eq('matching_configuration_id', id)
  check(result.error); return (result.count ?? 0) > 0
}
export type ConfigDraft = Configuration & { name: string; academic_period_id: string | null; is_active: boolean }
export async function saveConfiguration(draft: ConfigDraft, id?: string) {
  let validated: Configuration
  try { validated = validateConfiguration(draft) } catch { throw new FeatureError('Revisa la configuración: pesos no negativos que sumen exactamente 100, umbral de 0 a 100 y reglas válidas.') }
  if (!draft.name.trim() || draft.name.length > 160) throw new FeatureError('Escribe un nombre de hasta 160 caracteres.')
  const db = await adminClient()
  const payload = { ...validated, name: draft.name.trim(), academic_period_id: draft.academic_period_id, is_active: draft.is_active }
  if (id) {
    if (await configurationUsed(id)) throw new FeatureError('Esta configuración ya tiene historial. Usa Duplicar configuración.')
    const result = await db.from('PYRUnibague_MatchingConfigurations').update(payload).eq('id', id).select('id').single(); check(result.error)
  } else {
    const identity = await db.auth.getUser(); check(identity.error)
    if (!identity.data.user) throw new FeatureError('Inicia sesión nuevamente.')
    const result = await db.from('PYRUnibague_MatchingConfigurations').insert({ ...payload, created_by: identity.data.user.id }).select('id').single(); check(result.error)
  }
}
export async function updateConfigurationMetadata(id: string, name: string, active: boolean) {
  if (!name.trim() || name.length > 160) throw new FeatureError('Escribe un nombre de hasta 160 caracteres.')
  const db = await adminClient(); const result = await db.from('PYRUnibague_MatchingConfigurations').update({ name: name.trim(), is_active: active }).eq('id', id).select('id').single(); check(result.error)
}
export async function executeMatching(period: string, configuration: string) {
  const db = await adminClient()
  const result = await db.functions.invoke('matching-run', { body: { academic_period_id: period, matching_configuration_id: configuration } })
  if (result.error) {
    const context: unknown = 'context' in result.error ? result.error.context : null
    let code: unknown; let recovery = false
    if (context instanceof Response) { try { const body = await context.json() as { error?: unknown; recovery_required?: boolean }; code = body.error; recovery = body.recovery_required === true } catch { /* Safe generic error below. */ } }
    throw new FeatureError(recovery ? 'La ejecución necesita recuperación administrativa. Revisa el historial antes de reintentar.' : code === 'RUN_ALREADY_RUNNING' ? 'Ya hay una ejecución en curso para este periodo y configuración.' : code === 'CONFIGURATION_INVALID' ? 'La configuración no es compatible con hybrid-v0.1. Duplícala y revisa sus campos.' : 'No se confirmó la ejecución. Actualiza el historial para revisar su estado antes de reintentar.')
  }
  const value = result.data as { run_id?: unknown }
  if (typeof value?.run_id !== 'string') throw new FeatureError('Respuesta incompleta. Revisa el historial.')
  return value.run_id
}
export async function loadMatchingFilters() {
  const db = await client()
  const [students, profiles, positions, projects] = await Promise.all([
    allPages((from, to) => db.from('PYRUnibague_Students').select('id,user_id,student_code').order('id').range(from, to)),
    allPages((from, to) => db.from('PYRUnibague_UserProfiles').select('user_id,display_name').order('user_id').range(from, to)),
    allPages((from, to) => db.from('PYRUnibague_ProjectPositions').select('id,project_id,title').order('id').range(from, to)),
    allPages((from, to) => db.from('PYRUnibague_Projects').select('id,name').order('id').range(from, to)),
  ])
  const names = new Map(profiles.map(row => [row.user_id, row.display_name])); const projectNames = new Map(projects.map(row => [row.id, row.name]))
  return { students: students.map(s => ({ id: s.id, label: `${names.get(s.user_id) ?? 'Estudiante'} · ${s.student_code ?? s.id}` })), positions: positions.map(p => ({ id: p.id, label: `${projectNames.get(p.project_id) ?? 'Proyecto'} / ${p.title}` })) }
}
export type CandidateFilters = { student: string; position: string; state: 'all' | 'eligible' | 'blocked' | 'recommended' | 'below' }
export async function loadCandidates(run: RunRow, page: number, filters: CandidateFilters) {
  if (run.status !== 'completed') return { rows: [] as CandidateRow[], count: 0 }
  const db = await client()
  let query = db.from('PYRUnibague_MatchCandidates').select('*', { count: 'exact' }).eq('matching_run_id', run.id)
  if (filters.student) query = query.eq('student_id', filters.student)
  if (filters.position) query = query.eq('project_position_id', filters.position)
  if (filters.state === 'blocked') query = query.eq('is_eligible', false)
  if (filters.state !== 'all' && filters.state !== 'blocked') query = query.eq('is_eligible', true)
  const threshold = runThreshold(run)
  if (filters.state === 'recommended' || filters.state === 'below') {
    if (threshold === null) throw new FeatureError('Esta ejecución no tiene un umbral histórico verificable.')
    query = filters.state === 'recommended' ? query.gte('total_score', threshold) : query.lt('total_score', threshold)
  }
  const result = await query.order('total_score', { ascending: false, nullsFirst: false }).order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  check(result.error); return { rows: result.data ?? [], count: result.count ?? 0 }
}
