import { allPages, check, client, FeatureError, validUrl } from '../../../lib/supabase/feature-helpers'
import type { Row } from '../../../lib/supabase/feature-helpers'
export type Organization = Row<'PYRUnibague_Organizations'>
export type OrganizationEdit = Pick<Organization, 'organization_type_id' | 'legal_name' | 'display_name' | 'tax_id' | 'description' | 'website' | 'municipality_id'>
export const reviewLabels: Record<string, string> = { submitted: 'Solicitud enviada', pending_review: 'Pendiente de revisión', pending: 'Pendiente', changes_required: 'Cambios solicitados', changes_requested: 'Cambios solicitados', approved: 'Aprobado', rejected: 'Rechazado' }
export function statusLabel(status: string) { return reviewLabels[status] ?? status }
export function organizationCompleteness(org: Organization) {
  const sections = [{ label: 'Nombre legal', complete: Boolean(org.legal_name.trim()) }, { label: 'Tipo', complete: Boolean(org.organization_type_id) }, { label: 'Descripción', complete: Boolean(org.description?.trim()) }, { label: 'Municipio', complete: Boolean(org.municipality_id) }]
  return { sections, percent: Math.round(sections.filter(section => section.complete).length / sections.length * 100) }
}
export function editableOrganization(fields: OrganizationEdit): OrganizationEdit {
  if (!fields.legal_name.trim()) throw new FeatureError('Escribe el nombre legal de la organización.')
  if (!validUrl(fields.website ?? '')) throw new FeatureError('Usa una URL http o https válida.')
  return { legal_name: fields.legal_name.trim(), display_name: fields.display_name, organization_type_id: fields.organization_type_id, tax_id: fields.tax_id, description: fields.description, website: fields.website, municipality_id: fields.municipality_id }
}
export async function loadOrganizations(userId: string, selectedId?: string) {
  const db = await client()
  const [organizations, members, types, municipalities] = await Promise.all([
    db.from('PYRUnibague_Organizations').select('*').order('legal_name'),
    db.from('PYRUnibague_OrganizationMembers').select('*').eq('user_id', userId).eq('status', 'active'),
    db.from('PYRUnibague_OrganizationTypes').select('*').order('name'),
    allPages((from, to) => db.from('PYRUnibague_Municipalities').select('*').order('municipality_name').order('id').range(from, to)).then(data => ({ data, error: null })),
  ])
  for (const result of [organizations, members, types, municipalities]) check(result.error)
  const available = (organizations.data ?? []).filter(org => members.data?.some(member => member.organization_id === org.id))
  const organization = available.find(org => org.id === selectedId) ?? available.find(org => members.data?.some(member => member.organization_id === org.id && member.can_manage)) ?? available[0] ?? null
  const canManage = Boolean(members.data?.some(member => member.organization_id === organization?.id && member.can_manage))
  const [documents, reviews] = organization ? await Promise.all([
    db.from('PYRUnibague_OrganizationDocuments').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
    db.from('PYRUnibague_OrganizationReviews').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [], error: null }]
  check(documents.error); check(reviews.error)
  return { organizations: available, organization, canManage, types: types.data ?? [], municipalities: municipalities.data ?? [], documents: documents.data ?? [], reviews: reviews.data ?? [] }
}
export type OrganizationData = Awaited<ReturnType<typeof loadOrganizations>>
export async function organizationSubmissionAvailable() {
  const db = await client()
  const { data, error } = await db.rpc('pyr_unibague_external_registration_ready')
  // Presence of the migration, independently of the intentionally disabled signup gate.
  return !error && typeof data === 'boolean'
}
export async function submitOrganization(id: string) {
  const db = await client()
  const { error } = await db.rpc('pyr_unibague_submit_organization', { p_organization_id: id })
  if (error?.code === '23514') throw new FeatureError('Completa tipo, municipio, descripción y contacto principal antes de enviar la solicitud.')
  check(error)
}
export async function registerOrganization(fields: OrganizationEdit) {
  const edit = editableOrganization(fields); const db = await client()
  const result = await db.rpc('pyr_unibague_register_organization', { p_legal_name: edit.legal_name, p_display_name: edit.display_name, p_tax_id: edit.tax_id, p_description: edit.description, p_website: edit.website, p_organization_type_id: edit.organization_type_id, p_municipality_id: edit.municipality_id })
  check(result.error); return result.data
}
export async function saveOrganization(id: string, fields: OrganizationEdit) {
  const edit = editableOrganization(fields); const db = await client()
  check((await db.from('PYRUnibague_Organizations').update(edit).eq('id', id).select('id').single()).error)
}
