import { allPages, check, client } from '../../../lib/supabase/feature-helpers'
import type { Row } from '../../../lib/supabase/feature-helpers'
export type OrganizationContact = Row<'PYRUnibague_OrganizationContacts'>
export type ContactDraft = Pick<OrganizationContact,'full_name'|'position_title'|'email'|'phone'|'user_id'|'is_primary'>
export async function loadOrganizationContacts(organization: string) {
  const db = await client()
  return allPages((from,to)=>db.from('PYRUnibague_OrganizationContacts').select('*').eq('organization_id',organization).order('is_primary',{ascending:false}).order('full_name').order('id').range(from,to))
}
export async function saveOrganizationContact(organization: string, draft: ContactDraft, id?: string) {
  const db = await client()
  const result = await db.rpc('pyr_unibague_save_organization_contact',{ p_organization_id:organization,p_id:id??null,p_full_name:draft.full_name,p_position_title:draft.position_title,p_email:draft.email,p_phone:draft.phone,p_user_id:draft.user_id,p_is_primary:draft.is_primary })
  check(result.error)
}
export async function deleteOrganizationContact(organization: string,id:string) {
  const db = await client()
  const result = await db.from('PYRUnibague_OrganizationContacts').delete().eq('organization_id',organization).eq('id',id).select('id').single()
  check(result.error)
}
