import { beforeEach, expect, it, vi } from 'vitest'
import { mockFeatureClient } from '../../../test/feature-client'
import { deleteOrganizationContact, loadOrganizationContacts, saveOrganizationContact } from './contacts'
const clients=vi.hoisted(()=>({get:vi.fn()}))
vi.mock('../../../lib/supabase/client',()=>({getSupabase:clients.get}))
let mock:ReturnType<typeof mockFeatureClient>
beforeEach(()=>{mock=mockFeatureClient();clients.get.mockResolvedValue(mock.db)})
it('loads and deletes only within the explicitly selected organization',async()=>{
 mock.enqueue([]);await loadOrganizationContacts('own-org')
 expect(mock.calls).toContainEqual({table:'PYRUnibague_OrganizationContacts',operation:'eq',args:['organization_id','own-org']})
 mock.enqueue({id:'contact'});await deleteOrganizationContact('own-org','contact')
 expect(mock.calls).toContainEqual({table:'PYRUnibague_OrganizationContacts',operation:'eq',args:['id','contact']})
})
it('primary-contact change uses the atomic RPC without assigning a role',async()=>{
 mock.enqueue('contact')
 await saveOrganizationContact('own-org',{full_name:'Contact',position_title:'Manager',email:null,phone:null,user_id:'optional-user',is_primary:true},'contact')
 expect(mock.rpc).toHaveBeenCalledWith('pyr_unibague_save_organization_contact',{p_organization_id:'own-org',p_full_name:'Contact',p_id:'contact',p_position_title:'Manager',p_email:null,p_phone:null,p_user_id:'optional-user',p_is_primary:true})
 expect(mock.db.from).not.toHaveBeenCalled()
})
it('reports rejected contact deletion instead of claiming success',async()=>{
 mock.enqueue(null,{code:'23503',message:'Referenced by project'})
 await expect(deleteOrganizationContact('own-org','contact')).rejects.toThrow('operación')
})
