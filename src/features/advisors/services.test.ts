import { beforeEach, expect, it, vi } from 'vitest'
import { mockFeatureClient } from '../../test/feature-client'
import { changeOrganizationAdvisor, changeStudentAdvisor, loadAdvisorWorkspace, parseAdvisorWorkspace, saveArl, saveStaff, saveSpecialCase } from './services'
const clients=vi.hoisted(()=>({get:vi.fn()}))
vi.mock('../../lib/supabase/client',()=>({getSupabase:clients.get}))
let mock:ReturnType<typeof mockFeatureClient>
beforeEach(()=>{mock=mockFeatureClient();clients.get.mockResolvedValue(mock.db)})
it('uses distinct transactional RPCs without propagating organization changes to students',async()=>{
 mock.enqueue(['ADMIN']);mock.enqueue('history')
 await changeOrganizationAdvisor('org','period','advisor','2026-10-13')
 expect(mock.rpc).toHaveBeenLastCalledWith('pyr_unibague_change_organization_advisor',{p_organization_id:'org',p_academic_period_id:'period',p_advisor_id:'advisor',p_starts_on:'2026-10-13'})
 expect(mock.rpc).not.toHaveBeenCalledWith('pyr_unibague_change_student_advisor',expect.anything())
 expect(mock.db.from).not.toHaveBeenCalled()
 mock.enqueue(['ADMIN']);mock.enqueue(null)
 await changeStudentAdvisor('participation',null,'2026-10-13',' Reason ','source')
 expect(mock.rpc).toHaveBeenLastCalledWith('pyr_unibague_change_student_advisor',{p_participation_id:'participation',p_advisor_id:null,p_starts_on:'2026-10-13',p_reason:'Reason',p_source_assignment_id:'source'})
})
it('fails closed before mutation when ADMIN is absent or role verification fails',async()=>{
 mock.enqueue(['ADVISOR'])
 await expect(changeOrganizationAdvisor('org','period','advisor','2026-10-13')).rejects.toThrow('ADMIN')
 expect(mock.rpc).toHaveBeenCalledTimes(1)
 mock.enqueue(null,{code:'42501',message:'Denied'})
 await expect(saveArl('participation','Provider')).rejects.toThrow('permiso')
 expect(mock.db.from).not.toHaveBeenCalled()
})
it('only sends ARL name and permits clearing it administratively',async()=>{
 mock.enqueue(['ADMIN']);mock.enqueue({id:'participation'})
 await saveArl('participation','  ')
 expect(mock.calls.find(row=>row.operation==='update')?.args[0]).toEqual({arl_provider_name:null})
})
it('staff updates never change identity or grant roles',async()=>{
 mock.enqueue(['ADMIN']);mock.enqueue({id:'staff'})
 await saveStaff({user_id:'spoofed',phone:' 123 ',staff_code:' A ',academic_unit:null,status:'active'},'staff')
 expect(mock.calls.find(row=>row.operation==='update')?.args[0]).toEqual({phone:'123',staff_code:'A',academic_unit:null,status:'active'})
 expect(mock.calls.every(row=>row.table==='PYRUnibague_StaffProfiles')).toBe(true)
})
it('special-case review uses only the minimal administrative table',async()=>{
 mock.enqueue(['ADMIN']);mock.enqueue({id:'case'})
 await saveSpecialCase({participation_id:'p',case_type_code:'open-code',status:'open-status',requested_municipality_id:null,decision_notes:'Administrative basis'})
 expect(mock.calls.find(row=>row.operation==='insert')?.args[0]).toEqual({participation_id:'p',case_type_code:'open-code',status:'open-status',requested_municipality_id:null,decision_notes:'Administrative basis'})
})
it('selected period is sent to the secure projection and errors remain visible',async()=>{
 mock.enqueue({organizations:[],students:[],projects:[]})
 expect(await loadAdvisorWorkspace('period')).toEqual({organizations:[],students:[],projects:[]})
 expect(mock.rpc).toHaveBeenCalledWith('pyr_unibague_advisor_workspace',{p_academic_period_id:'period'})
 mock.enqueue(null,{code:'42501',message:'denied'})
 await expect(loadAdvisorWorkspace('other-period')).rejects.toThrow('permiso')
})
it('validates projected JSON and excludes unexpected private attributes',()=>{
 const result=parseAdvisorWorkspace({organizations:[],projects:[],students:[{participation_id:'p',name:'Student',program:null,semester:6,bio:'Professional',desired_work_description:null,starts_on:'2026-10-13',experiences:[],skills:[],interests:[],student_code:'private',documents:['private'],decision_notes:'private'}]})
 expect(result.students[0]).not.toHaveProperty('student_code')
 expect(result.students[0]).not.toHaveProperty('documents')
 expect(result.students[0]).not.toHaveProperty('decision_notes')
 expect(()=>parseAdvisorWorkspace({organizations:[],projects:[],students:[{name:'broken'}]})).toThrow('incompleta')
 expect(()=>parseAdvisorWorkspace({organizations:{},projects:[],students:[]})).toThrow('incompleta')
})
