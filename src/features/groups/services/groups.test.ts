import { beforeEach,describe,expect,it,vi } from 'vitest'
import { mockFeatureClient } from '../../../test/feature-client'
import { addGroupMember,availableAssignments,parseProjectTeam,readProjectTeam,retireGroupMember,saveGroup } from './groups'
import type { Group,GroupMember,TeamAssignment } from './groups'
const getter = vi.hoisted(() => ({ get:vi.fn() }))
vi.mock('../../../lib/supabase/client',() => ({ getSupabase:getter.get }))
let mock: ReturnType<typeof mockFeatureClient>
beforeEach(() => { mock = mockFeatureClient(); getter.get.mockResolvedValue(mock.db) })
const group: Group = { id:'g',project_id:'p',name:'Equipo',status:'active',started_on:null,created_at:'',updated_at:'' }
const assignment: TeamAssignment = { id:'a',student_id:'s',display_name:'Estudiante',program_name:'Programa',position_title:'Plaza',is_active:true,status:'confirmed',unassigned_at:null }
const member: GroupMember = { id:'m',group_id:'g',assignment_id:'a',joined_on:'2026-10-01',left_on:null,status:'active',created_at:'',updated_at:'' }
describe('P6B groups',() => {
  it('reads the scoped roster RPC and validates its response',async () => {
    mock.enqueue({ groups:[group],members:[member],assignments:[assignment] })
    expect((await readProjectTeam('p')).members).toEqual([member])
    expect(mock.rpc).toHaveBeenCalledWith('pyr_unibague_project_team',{ p_project_id:'p' })
  })
  it.each([null,{}, { groups:[],members:[],assignments:[{ ...assignment,is_active:'true' }] }])('rejects malformed roster %o',value => { expect(() => parseProjectTeam(value)).toThrow() })
  it('creates and edits group fields without moving the project',async () => {
    await saveGroup(null,'p',group); await saveGroup('g','p',Object.assign({ ...group },{ project_id:'other' }))
    expect(mock.calls.find(call => call.operation === 'insert')?.args[0]).toMatchObject({ project_id:'p',name:'Equipo' })
    expect(mock.calls.find(call => call.operation === 'update')?.args[0]).not.toHaveProperty('project_id')
  })
  it('excludes already linked and unconfirmed assignments from available options',() => {
    const team = { groups:[group],members:[member],assignments:[assignment,{ ...assignment,id:'b',status:'pending' },{ ...assignment,id:'c' }] }
    expect(availableAssignments(team).map(row => row.id)).toEqual(['c'])
  })
  it('adds a membership referencing an assignment without storing names or creating assignments',async () => {
    await addGroupMember(group,assignment,null)
    expect(mock.calls.find(call => call.operation === 'insert')?.args[0]).toEqual({ group_id:'g',assignment_id:'a',joined_on:null,status:'active' })
    expect(mock.calls.every(call => call.table === 'PYRUnibague_GroupMembers')).toBe(true)
  })
  it('does not add an inactive or unconfirmed assignment or a member to a closed group',async () => {
    await expect(addGroupMember(group,{ ...assignment,is_active:false },null)).rejects.toThrow('confirmadas')
    await expect(addGroupMember(group,{ ...assignment,status:'pending' },null)).rejects.toThrow('confirmadas')
    await expect(addGroupMember({ ...group,status:'closed' },assignment,null)).rejects.toThrow('confirmadas')
  })
  it('retires instead of deleting, preserving joined date and assignment reference',async () => {
    await retireGroupMember(member,'2026-10-13')
    expect(mock.calls.find(call => call.operation === 'update')?.args[0]).toEqual({ status:'inactive',left_on:'2026-10-13' })
    expect(mock.calls.some(call => call.operation === 'delete')).toBe(false)
    await expect(retireGroupMember(member,'2026-09-30')).rejects.toThrow('salida')
  })
  it('rejects nonexistent calendar dates',async () => {
    await expect(saveGroup(null,'p',{ name:'Equipo',status:'active',started_on:'2026-02-30' })).rejects.toThrow('Fecha')
    await expect(addGroupMember(group,assignment,'2026-02-30')).rejects.toThrow('Fecha')
  })
  it('surfaces duplicate memberships from PostgreSQL',async () => {
    mock.enqueue(null,{ code:'23505',message:'duplicate' }); await expect(addGroupMember(group,assignment,null)).rejects.toThrow('duplicados')
  })
})
