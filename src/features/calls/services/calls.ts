import { allPages, check, client, FeatureError } from '../../../lib/supabase/feature-helpers'
import type { Row } from '../../../lib/supabase/feature-helpers'
export type CallStatus = 'draft' | 'submitted' | 'changes_required' | 'open' | 'closed'
export type Call = Row<'PYRUnibague_Calls'>
export type CallPosition = Row<'PYRUnibague_CallPositions'>
const callClient = client
export const callStates: Record<CallStatus, string> = { draft: 'Borrador', submitted: 'Enviada', changes_required: 'Cambios solicitados', open: 'Abierta', closed: 'Cerrada' }
export const callEditable = (status: CallStatus) => status === 'draft' || status === 'changes_required'
export async function callContext(user: string, admin: boolean) {
  const db = await callClient()
  const [periods, organizations, memberships] = await Promise.all([
    allPages((a,b) => db.from('PYRUnibague_AcademicPeriods').select('*').order('starts_on', { ascending: false }).order('id').range(a,b)),
    allPages((a,b) => db.from('PYRUnibague_Organizations').select('id, legal_name, status, verified_at').order('legal_name').order('id').range(a,b)),
    admin ? Promise.resolve([]) : allPages((a,b) => db.from('PYRUnibague_OrganizationMembers').select('organization_id, can_manage').eq('user_id', user).eq('status','active').order('id').range(a,b)),
  ])
  return { periods, organizations, memberships }
}
export async function listCalls(page: number, filters: { organization?: string; period?: string; status?: string }) {
  const db = await callClient()
  let query = db.from('PYRUnibague_Calls').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id')
  if (filters.organization) query = query.eq('organization_id', filters.organization)
  if (filters.period) query = query.eq('academic_period_id', filters.period)
  if (filters.status) {
    if (!Object.hasOwn(callStates,filters.status)) throw new FeatureError('Estado inválido.')
    query = query.eq('status', filters.status as CallStatus)
  }
  const result = await query.range(page * 25, page * 25 + 24); check(result.error)
  const rows = result.data ?? []
  const links = rows.length ? await allPages((a,b) => db.from('PYRUnibague_CallPositions').select('*').in('call_id', rows.map(row => row.id)).order('id').range(a,b)) : []
  const ids = [...new Set(links.map(link => link.project_position_id))]
  const capacities = new Map<string, number>()
  for (let offset = 0; offset < ids.length; offset += 100) {
    const positions = await allPages((a,b) => db.from('PYRUnibague_ProjectPositions').select('id, capacity').in('id', ids.slice(offset, offset + 100)).order('id').range(a,b))
    positions.forEach(position => capacities.set(position.id, position.capacity))
  }
  return { rows: rows.map(row => ({ ...row, capacity: [...new Set(links.filter(link => link.call_id === row.id).map(link => link.project_position_id))].reduce((sum,id) => sum + (capacities.get(id) ?? 0), 0) })), count: result.count ?? 0, uniqueCapacity: [...capacities.values()].reduce((sum,n) => sum + n, 0) }
}
export async function callDetail(id: string) {
  const db = await callClient()
  const [call, links] = await Promise.all([
    db.from('PYRUnibague_Calls').select('*').eq('id',id).single(),
    allPages((a,b) => db.from('PYRUnibague_CallPositions').select('*').eq('call_id',id).order('id').range(a,b)),
  ])
  check(call.error)
  const row = call.data!
  const positions = await eligiblePositions(row.organization_id, row.academic_period_id)
  return { call: row, links, positions }
}
export async function eligiblePositions(organization: string, period: string) {
  const db = await callClient()
  return allPages((a,b) => db.from('PYRUnibague_ProjectPositions')
    .select('*, PYRUnibague_Projects!inner(name, organization_id, academic_period_id), PYRUnibague_ProjectPositionPrograms(PYRUnibague_AcademicPrograms(name))')
    .eq('PYRUnibague_Projects.organization_id',organization).eq('PYRUnibague_Projects.academic_period_id',period).order('id').range(a,b))
}
export type CallEdit = Pick<Call, 'title' | 'details' | 'academic_period_id' | 'opens_at' | 'closes_at'>
export function validateCall(fields: CallEdit) {
  if (!fields.title.trim() || fields.title.trim().length > 240 || !fields.academic_period_id) throw new FeatureError('Nombre y periodo son obligatorios.')
  for (const value of [fields.opens_at, fields.closes_at]) if (value && !Number.isFinite(Date.parse(value))) throw new FeatureError('Fecha inválida.')
  if (fields.opens_at && fields.closes_at && Date.parse(fields.closes_at) < Date.parse(fields.opens_at)) throw new FeatureError('El cierre debe ser posterior a la apertura.')
}
export async function saveCall(id: string | null, organization: string, fields: CallEdit) {
  validateCall(fields)
  if (!organization) throw new FeatureError('Selecciona una organización.')
  const edit: CallEdit = { title: fields.title.trim(), details: fields.details, academic_period_id: fields.academic_period_id, opens_at: fields.opens_at, closes_at: fields.closes_at }
  const db = await callClient()
  const result = id ? await db.from('PYRUnibague_Calls').update(edit).eq('id',id).select('id').single() : await db.from('PYRUnibague_Calls').insert({ ...edit, organization_id: organization, status: 'draft' }).select('id').single()
  check(result.error); return result.data!.id
}
export async function changeCallState(id: string, status: CallStatus) {
  if (!Object.hasOwn(callStates, status)) throw new FeatureError('Estado inválido.')
  const db = await callClient(); check((await db.from('PYRUnibague_Calls').update({ status }).eq('id',id).select('id').single()).error)
}
export async function linkCallPosition(call: Pick<Call, 'id' | 'organization_id' | 'academic_period_id'>, position: Awaited<ReturnType<typeof eligiblePositions>>[number]) {
  if (position.PYRUnibague_Projects.organization_id !== call.organization_id || position.PYRUnibague_Projects.academic_period_id !== call.academic_period_id) throw new FeatureError('La plaza pertenece a otra organización o periodo.')
  const db = await callClient(); check((await db.from('PYRUnibague_CallPositions').insert({ call_id: call.id, project_position_id: position.id }).select('id').single()).error)
}
export async function unlinkCallPosition(id: string) {
  const db = await callClient(); check((await db.from('PYRUnibague_CallPositions').delete().eq('id',id).select('id').single()).error)
}
export function bogotaDateTime(value: string | null) {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
export function bogotaInstant(value: string) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new FeatureError('Fecha inválida.')
  const instant = new Date(value + ':00-05:00')
  if (!Number.isFinite(instant.getTime())) throw new FeatureError('Fecha inválida.')
  return instant.toISOString()
}
