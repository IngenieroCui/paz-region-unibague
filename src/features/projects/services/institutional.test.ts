import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFeatureClient } from '../../../test/feature-client'
import { institutionalSheet, parseZoneType, unavailableInstitutionalReader, zoneLabel } from './institutional'
import { saveProject } from './projects'
const getter = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: getter.get }))
let mock: ReturnType<typeof mockFeatureClient>
beforeEach(() => { mock = mockFeatureClient(); getter.get.mockResolvedValue(mock.db) })
const fields = { name: 'Proyecto', summary: null, description: null, academic_period_id: 'period', municipality_id: null, modality: null }
describe('P6B institutional contract', () => {
  it.each(['rural', 'urban', null] as const)('saves geographic zone %s without duplicating identities', async zone_type => {
    mock.enqueue({ id: 'p' })
    await saveProject('p', 'ignored-org', 'ignored-user', { ...fields, zone_type })
    expect(mock.calls.find(call => call.operation === 'update')?.args[0]).toEqual({ ...fields, zone_type })
  })
  it('rejects injected invalid zones before a request', async () => {
    await expect(saveProject('p', 'org', 'user', Object.assign({ ...fields },{ zone_type:'remote' }) as unknown as Parameters<typeof saveProject>[3])).rejects.toThrow('Zona')
    expect(mock.calls).toHaveLength(0)
    expect(() => parseZoneType('remote')).toThrow('Zona')
  })
  it('preserves unknown zone as null and labels geography', () => {
    expect(parseZoneType('')).toBeNull()
    expect(parseZoneType('rural')).toBe('rural')
    expect(parseZoneType('urban')).toBe('urban')
    expect(zoneLabel(null)).toBe('Sin registrar')
    expect(zoneLabel('rural')).toBe('Rural')
    expect(zoneLabel('urban')).toBe('Urbana')
  })
  it('loads all plazas and program links, then leaves absent A tables unqueried', async () => {
    mock.enqueue({ id: 'p', organization_id: 'org', academic_period_id: 'period' })
    mock.enqueue([{ id: 'systems', capacity: 2 }, { id: 'mechanical', capacity: 1 }])
    mock.enqueue([{ project_position_id: 'systems', PYRUnibague_AcademicPrograms: { name: 'Sistemas' } }, { project_position_id: 'mechanical', PYRUnibague_AcademicPrograms: { name: 'Mecánica' } }])
    const data = await institutionalSheet('p')
    expect(data.positions.reduce((sum, row) => sum + row.capacity, 0)).toBe(3)
    expect(data.people).toEqual({ availability: 'not_integrated', advisors: [], interlocutors: [] })
    expect(mock.calls.every(call => !/Interlocutors|AdvisorOrganization/.test(call.table))).toBe(true)
  })
  it('passes project, organization and period to the integrated person reader', async () => {
    const project = { id: 'p2', organization_id: 'org', academic_period_id: 'period' }
    mock.enqueue(project); mock.enqueue([])
    const reader = vi.fn(unavailableInstitutionalReader)
    await institutionalSheet('p2', reader)
    expect(reader).toHaveBeenCalledWith(project)
  })
  it('surfaces RLS denial instead of treating it as missing institutional data', async () => {
    mock.enqueue(null, { code: '42501', message: 'denied' })
    await expect(institutionalSheet('foreign-project')).rejects.toThrow('permiso')
    expect(mock.calls.some(call => call.table === 'PYRUnibague_ProjectPositions')).toBe(false)
  })
})
