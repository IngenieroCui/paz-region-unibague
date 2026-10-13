import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../lib/supabase/database.types'
import { allPages, check, client, FeatureError } from '../../lib/supabase/feature-helpers'
import type { AssignmentAction, AssignmentSnapshot } from './types'

type CommonArgs = { p_period_id: string; p_run_id: string | null; p_revision: string }
type AssignmentDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Functions'> & { Functions: Database['public']['Functions'] & {
  pyr_unibague_assignment_snapshot: { Args: { p_period_id: string; p_run_id: string | null }; Returns: Json }
  pyr_unibague_confirm_assignment_batch: { Args: CommonArgs & { p_actions: Json }; Returns: Json }
  pyr_unibague_confirm_assignment: { Args: CommonArgs & { p_action: Json }; Returns: Json }
  pyr_unibague_reassign_assignment: { Args: CommonArgs & { p_action: Json }; Returns: Json }
  pyr_unibague_unassign_assignment: { Args: CommonArgs & { p_action: Json }; Returns: Json }
} } }
/** Local extension for migration 010; the global generated/fallback types belong to the integrator. */
async function assignmentClient() { return await client() as unknown as SupabaseClient<AssignmentDatabase> }
function assignmentError(error: { code?: string; message: string } | null) {
  if (!error) return
  if (error.code === 'P0001') throw new FeatureError('La propuesta cambió o el cupo se agotó. Actualiza y recalcula; no se confirmó ninguna fila del lote.', error.code)
  if (error.code === '23514') throw new FeatureError('La asignación no cumple elegibilidad, periodo, capacidad o compatibilidad. Revisa los datos y recalcula.', error.code)
  if (error.code === '22023' || error.code === '22P02') throw new FeatureError('Revisa la ejecución, el destino y el motivo de intervención.', error.code)
  if (error.code === '40P01' || error.code === '40001') throw new FeatureError('Hubo un cambio concurrente. Actualiza y recalcula antes de confirmar.', 'P0001')
  check(error)
}
export async function loadAssignmentMetadata() {
  const db = await client(); const roles = await db.rpc('pyr_unibague_current_roles'); check(roles.error)
  if (!roles.data?.includes('ADMIN')) throw new FeatureError('Asignaciones requiere el rol ADMIN.', '42501')
  const [periods, runs] = await Promise.all([
    allPages((from, to) => db.from('PYRUnibague_AcademicPeriods').select('*').order('created_at', { ascending: false }).order('id').range(from, to)),
    allPages((from, to) => db.from('PYRUnibague_MatchingRuns').select('*').eq('status', 'completed').order('created_at', { ascending: false }).order('id').range(from, to)),
  ])
  return { periods, runs }
}
export async function loadAssignmentSnapshot(periodId: string, runId: string | null): Promise<AssignmentSnapshot> {
  const db = await assignmentClient(); const result = await db.rpc('pyr_unibague_assignment_snapshot', { p_period_id: periodId, p_run_id: runId }); assignmentError(result.error)
  const snapshot = result.data as unknown as AssignmentSnapshot
  if (!snapshot || snapshot.periodId !== periodId || typeof snapshot.revision !== 'string' || !Array.isArray(snapshot.students) || !Array.isArray(snapshot.positions) || !Array.isArray(snapshot.candidates) || !Array.isArray(snapshot.existing)) throw new FeatureError('Respuesta incompleta del servidor de asignaciones.')
  return snapshot
}
export async function commitAssignments(snapshot: AssignmentSnapshot, actions: AssignmentAction[]) {
  if (!actions.length || actions.length > 500) throw new FeatureError('Confirma entre 1 y 500 asignaciones por lote.')
  const db = await assignmentClient()
  const args: CommonArgs = { p_period_id: snapshot.periodId, p_run_id: snapshot.run?.id ?? null, p_revision: snapshot.revision }
  const action = actions[0]!
  if (actions.length > 1 && actions.some(a => a.kind !== 'confirm')) throw new FeatureError('Reasigna o retira individualmente para revisar cada intervención.')
  try {
    if (actions.length === 1) {
      const name = action.kind === 'unassign' ? 'pyr_unibague_unassign_assignment' : action.kind === 'reassign' ? 'pyr_unibague_reassign_assignment' : 'pyr_unibague_confirm_assignment'
      const result = await db.rpc(name, { ...args, p_action: action as unknown as Json }); assignmentError(result.error); return result.data
    }
    const result = await db.rpc('pyr_unibague_confirm_assignment_batch', { ...args, p_actions: actions as unknown as Json }); assignmentError(result.error); return result.data
  } catch (cause) {
    if (cause instanceof FeatureError && ['42501', 'P0001', '23514', '22023', '22P02', '23505'].includes(cause.code)) throw cause
    throw new FeatureError('No se pudo verificar el resultado. Actualiza cupos e historial antes de reintentar.', 'UNCERTAIN_COMMIT')
  }
}
export type HistoryFilters = { studentId?: string; positionIds?: string[]; activeOnly?: boolean }
export async function loadAssignmentHistory(periodId: string, page: number, filters: HistoryFilters = {}) {
  if (filters.positionIds?.length === 0) return { rows: [], count: 0 }
  const db = await client()
  let query = db.from('PYRUnibague_Assignments').select('*', { count: 'exact' }).eq('academic_period_id', periodId)
  if (filters.studentId) query = query.eq('student_id', filters.studentId)
  if (filters.positionIds) query = query.in('project_position_id', filters.positionIds)
  if (filters.activeOnly) query = query.eq('is_active', true)
  const result = await query.order('assigned_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24)
  check(result.error); return { rows: result.data ?? [], count: result.count ?? 0 }
}
/** Events remain ADMIN-only under the existing RLS contract. */
export async function loadAssignmentEvents(assignmentId: string, page: number) {
  const db = await client(); const result = await db.from('PYRUnibague_AssignmentEvents').select('*', { count: 'exact' }).eq('assignment_id', assignmentId).order('created_at').order('id').range(page * 25, page * 25 + 24)
  check(result.error); return { rows: result.data ?? [], count: result.count ?? 0 }
}
