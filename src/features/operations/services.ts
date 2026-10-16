import { allPages, check, client, FeatureError } from '../../lib/supabase/feature-helpers'

export const metricKeys = ['pendingOrganizations', 'pendingProjects', 'unassignedEligible', 'vacantPositions', 'vacantCapacity', 'organizationsWithoutAdvisor', 'assignmentsWithoutAdvisor', 'assignmentsRequiringReview'] as const
export type OperationalSummary = Record<typeof metricKeys[number], number>
export type ExportKind = 'assignments' | 'positions'
export type ExportRow = Record<string, string | number | boolean | null> & { id: string }
export function parseSummary(value: unknown): OperationalSummary {
  if (!value || typeof value !== 'object') throw new FeatureError('Respuesta de pendientes inválida.')
  const row = value as Record<string, unknown>
  for (const key of metricKeys) if (typeof row[key] !== 'number' || !Number.isSafeInteger(row[key]) || row[key] < 0) throw new FeatureError('Respuesta de pendientes inválida.')
  return Object.fromEntries(metricKeys.map(key => [key, row[key]])) as OperationalSummary
}
export async function operationalPeriods() {
  const db = await client()
  return allPages((from, to) => db.from('PYRUnibague_AcademicPeriods').select('*').order('created_at', { ascending: false }).order('id').range(from, to))
}
export async function operationalSummary(period: string) {
  const db = await client(), result = await db.rpc('pyr_unibague_operational_summary', { p_period_id: period })
  check(result.error); return parseSummary(result.data)
}
export async function operationalExport(period: string, kind: ExportKind) {
  const db = await client(), rows: ExportRow[] = []
  let after: string | null = null
  for (;;) {
    const result = await db.rpc('pyr_unibague_operational_export', { p_period_id: period, p_kind: kind, p_after_id: after })
    check(result.error)
    if (!Array.isArray(result.data)) throw new FeatureError('Respuesta de exportación inválida.')
    const batch: ExportRow[] = result.data.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.id !== 'string' || Object.values(value).some(cell => cell !== null && !['string', 'number', 'boolean'].includes(typeof cell))) throw new FeatureError('Fila de exportación inválida.')
      return value as ExportRow
    })
    if (batch.some((row, index) => row.id <= (index ? batch[index - 1]!.id : after ?? ''))) throw new FeatureError('La exportación no conserva el orden esperado. Actualiza y reintenta.')
    rows.push(...batch)
    if (batch.length < 500) return rows
    after = batch.at(-1)!.id
  }
}
