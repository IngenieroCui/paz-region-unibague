import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFeatureClient } from '../../../test/feature-client'
import { editableOrganization, loadOrganizations, organizationCompleteness, registerOrganization, saveOrganization, statusLabel, submitOrganization, organizationSubmissionAvailable } from './organizations'
import type { Organization, OrganizationEdit } from './organizations'
const clientMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: clientMock.get }))
let mock: ReturnType<typeof mockFeatureClient>
const fields: OrganizationEdit = { legal_name: 'Entidad', display_name: null, tax_id: null, description: null, website: null, municipality_id: null, organization_type_id: null }
beforeEach(() => { mock = mockFeatureClient(); clientMock.get.mockResolvedValue(mock.db) })
describe('Organization workflows', () => {
  it('submits only through the protected workflow RPC', async () => {
    await submitOrganization('a')
    expect(mock.rpc).toHaveBeenCalledWith('pyr_unibague_submit_organization', { p_organization_id: 'a' }); expect(mock.calls).toHaveLength(0)
    mock.enqueue(null, { code: '23514', message: 'incomplete' }); await expect(submitOrganization('a')).rejects.toThrow('contacto principal')
  })
  it('detects a staged migration independently from disabled account signup', async () => {
    mock.enqueue(false); expect(await organizationSubmissionAvailable()).toBe(true)
    mock.enqueue(null,{ code: 'PGRST202', message: 'missing' }); expect(await organizationSubmissionAvailable()).toBe(false)
  })
  it('resolves onboarding when there is no active membership', async () => {
    mock.enqueue([]); mock.enqueue([]); mock.enqueue([]); mock.enqueue([])
    const data = await loadOrganizations('u'); expect(data.organization).toBeNull(); expect(data.canManage).toBe(false)
  })
  it('selects an existing managed organization and reads its documents and reviews', async () => {
    mock.enqueue([{ id: 'a', legal_name: 'A' }, { id: 'b', legal_name: 'B' }]); mock.enqueue([{ organization_id: 'a', can_manage: false }, { organization_id: 'b', can_manage: true }]); mock.enqueue([]); mock.enqueue([]); mock.enqueue([{ id: 'd' }]); mock.enqueue([{ id: 'r', notes: 'Observación' }])
    const data = await loadOrganizations('u'); expect(data.organization?.id).toBe('b'); expect(data.canManage).toBe(true); expect(data.reviews).toHaveLength(1); expect(data.documents).toHaveLength(1)
    expect(mock.calls.some(call => call.table === 'PYRUnibague_OrganizationReviews' && ['insert','update','delete'].includes(call.operation))).toBe(false)
  })
  it('registers only via the P3 RPC with allowed inputs', async () => {
    mock.enqueue('organization-id'); expect(await registerOrganization(fields)).toBe('organization-id')
    expect(mock.rpc).toHaveBeenCalledWith('pyr_unibague_register_organization', expect.objectContaining({ p_legal_name: 'Entidad' })); expect(mock.calls).toHaveLength(0)
  })
  it('cannot send status, verification, creator or identity through profile edits', async () => {
    const malicious = { ...fields, status: 'approved', verified_at: '2026-10-01', verified_by: 'u', created_by: 'u', id: 'b' }
    const edit = editableOrganization(malicious); expect(edit).toEqual(fields)
    mock.enqueue({ id: 'a' }); await saveOrganization('a', malicious)
    expect(mock.calls.find(call => call.operation === 'update')?.args[0]).toEqual(fields)
  })
  it('rejects invalid registration inputs and propagates RPC denial', async () => {
    await expect(registerOrganization({ ...fields, website: 'javascript:alert(1)' })).rejects.toThrow()
    mock.enqueue(null, { code: '42501', message: 'denied' }); await expect(registerOrganization(fields)).rejects.toThrow('permiso')
  })
  it('keeps completeness separate from status and verification', () => {
    const org = { ...fields, description: 'Descripción', organization_type_id: 't', municipality_id: 'm', status: 'pending_review', verified_at: null } as Organization
    expect(organizationCompleteness(org).percent).toBe(100); expect(org.verified_at).toBeNull(); expect(statusLabel('changes_requested')).toBe('Cambios solicitados'); expect(statusLabel('institutional-new-state')).toBe('institutional-new-state')
  })
})
