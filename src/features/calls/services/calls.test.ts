import { beforeEach,describe,expect,it,vi } from 'vitest'
import { mockFeatureClient } from '../../../test/feature-client'
import { bogotaDateTime,bogotaInstant,changeCallState,linkCallPosition,listCalls,saveCall,unlinkCallPosition,validateCall } from './calls'
const getter = vi.hoisted(() => ({ get:vi.fn() }))
vi.mock('../../../lib/supabase/client',() => ({ getSupabase:getter.get }))
let mock: ReturnType<typeof mockFeatureClient>
beforeEach(() => { mock = mockFeatureClient(); getter.get.mockResolvedValue(mock.db) })
const fields = { title:'Convocatoria',details:null,academic_period_id:'period',opens_at:null,closes_at:null }
describe('P6B calls',() => {
  it('creates a draft with only whitelisted fields and optional dates',async () => {
    mock.enqueue({ id:'call' }); await saveCall(null,'org',Object.assign({ ...fields },{ status:'open',capacity:99 }))
    expect(mock.calls.find(call => call.operation === 'insert')?.args[0]).toEqual({ ...fields,organization_id:'org',status:'draft' })
  })
  it('edits without moving organization or injecting status',async () => {
    mock.enqueue({ id:'call' }); await saveCall('call','other',Object.assign({ ...fields },{ organization_id:'evil',status:'open' }))
    expect(mock.calls.find(call => call.operation === 'update')?.args[0]).toEqual(fields)
  })
  it('validates dates before a write',async () => {
    await expect(saveCall(null,'org',{ ...fields,opens_at:'2026-10-20T10:00:00Z',closes_at:'2026-10-19T10:00:00Z' })).rejects.toThrow('cierre')
    expect(() => validateCall({ ...fields,opens_at:'bad' })).toThrow('Fecha')
    expect(() => validateCall({ ...fields,title:' ' })).toThrow('Nombre')
    expect(mock.calls).toHaveLength(0)
  })
  it('uses Colombia timezone independently of the host timezone',() => {
    expect(bogotaInstant('2026-10-13T10:30')).toBe('2026-10-13T15:30:00.000Z')
    expect(bogotaDateTime('2026-10-13T15:30:00Z')).toBe('2026-10-13T10:30')
    expect(bogotaInstant('')).toBeNull(); expect(bogotaDateTime(null)).toBe('')
    expect(() => bogotaInstant('2026-10-13')).toThrow('Fecha')
  })
  it('counts distinct plaza capacity across calls, never program compatibility',async () => {
    mock.enqueue([{ id:'c1' },{ id:'c2' }],null,2)
    mock.enqueue([{ call_id:'c1',project_position_id:'systems' },{ call_id:'c1',project_position_id:'mechanical' },{ call_id:'c2',project_position_id:'systems' }])
    mock.enqueue([{ id:'systems',capacity:2 },{ id:'mechanical',capacity:1 }])
    const result = await listCalls(0,{ organization:'org',period:'period',status:'draft' })
    expect(result.rows.map(row => row.capacity)).toEqual([3,2]); expect(result.uniqueCapacity).toBe(3)
    expect(mock.calls.find(call => call.operation === 'range')?.args).toEqual([0,24])
    expect(mock.calls.some(call => call.operation === 'eq' && call.args[0] === 'organization_id')).toBe(true)
  })
  it.each([{ organization_id:'other',academic_period_id:'period' },{ organization_id:'org',academic_period_id:'other' }])('rejects mismatched plaza %o before writing',async project => {
    const position = { id:'pos',project_id:'p',title:'Plaza',description:null,capacity:2,status:'open',is_active:true,created_at:'',updated_at:'',PYRUnibague_Projects:{ name:'Proyecto',...project },PYRUnibague_ProjectPositionPrograms:[] }
    await expect(linkCallPosition({ id:'call',organization_id:'org',academic_period_id:'period' },position)).rejects.toThrow('otra organización o periodo')
    expect(mock.calls).toHaveLength(0)
  })
  it('links without copying capacity and removes only the link',async () => {
    mock.enqueue({ id:'link' }); await linkCallPosition({ id:'call',organization_id:'org',academic_period_id:'period' },{ id:'pos',project_id:'p',title:'Plaza',description:null,capacity:2,status:'open',is_active:true,created_at:'',updated_at:'',PYRUnibague_Projects:{ name:'Proyecto',organization_id:'org',academic_period_id:'period' },PYRUnibague_ProjectPositionPrograms:[] })
    expect(mock.calls.find(call => call.operation === 'insert')?.args[0]).toEqual({ call_id:'call',project_position_id:'pos' })
    mock.enqueue({ id:'link' }); await unlinkCallPosition('link'); expect(mock.calls.find(call => call.operation === 'delete')?.table).toBe('PYRUnibague_CallPositions')
  })
  it('propagates backend authorization errors on administrative state changes',async () => {
    mock.enqueue(null,{ code:'42501',message:'denied' }); await expect(changeCallState('call','changes_required')).rejects.toThrow('permiso')
  })
})
