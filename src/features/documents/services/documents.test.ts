import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFeatureClient } from '../../../test/feature-client'
import { cleanupUpload, deleteDocument, documentUrl, maxFileBytes, uploadDocument, validateFile } from './documents'
import type { DocumentRow } from './documents'
const clientMock = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: clientMock.get }))
let mock: ReturnType<typeof mockFeatureClient>
const file = () => new File(['%PDF-1.7'], 'mi cv.pdf', { type: 'application/pdf' })
const document = { id: 'd', object_path: 's/d/cv.pdf', file_name: 'cv.pdf' } as DocumentRow
beforeEach(() => { mock = mockFeatureClient(); clientMock.get.mockResolvedValue(mock.db) })
describe('Private document workflows', () => {
  it('validates empty, oversized, unsafe and mismatched files before upload', () => {
    expect(() => validateFile(new File([], 'a.pdf', { type: 'application/pdf' }))).toThrow()
    expect(() => validateFile(new File([new Uint8Array(maxFileBytes + 1)], 'a.pdf', { type: 'application/pdf' }))).toThrow()
    expect(() => validateFile(new File(['x'], '../a.pdf', { type: 'application/pdf' }))).toThrow()
    expect(() => validateFile(new File(['x'], 'a.pdf', { type: 'text/html' }))).toThrow()
    expect(() => validateFile(file())).not.toThrow()
  })
  for (const scope of ['student','organization'] as const) it(`uploads ${scope} binaries privately and saves matching metadata`, async () => {
    mock.enqueue(null); const stage = vi.fn()
    await uploadDocument(scope, 'owner', 'user', file(), 'CV', stage)
    const args = mock.upload.mock.calls[0] as unknown as [string, File, { upsert: boolean }]
    expect(args[0]).toMatch(/^owner\/[0-9a-f-]{36}\/mi_cv.pdf$/); expect(args[2].upsert).toBe(false)
    const metadata = mock.calls.find(call => call.operation === 'insert')?.args[0]
    expect(metadata).toMatchObject({ object_path: args[0], uploaded_by: 'user', category_code: 'CV', status: 'uploaded', [`${scope}_id`]: 'owner' }); expect(stage).toHaveBeenCalledTimes(2)
  })
  it('does not save metadata after an upload failure', async () => {
    mock.upload.mockResolvedValueOnce({ data: {}, error: { message: 'upload failed' } })
    await expect(uploadDocument('student', 's', 'u', file(), 'CV')).rejects.toThrow(); expect(mock.calls.some(call => call.operation === 'insert')).toBe(false)
  })
  it('compensates a rejected metadata insert', async () => {
    mock.enqueue(null, { message: 'metadata failed' }); mock.enqueue(null)
    await expect(uploadDocument('student', 's', 'u', file(), 'CV')).rejects.toMatchObject({ code: 'metadata' }); expect(mock.remove).toHaveBeenCalledOnce()
  })
  it('retains a cleanup handle when compensating Storage fails', async () => {
    mock.enqueue(null, { message: 'metadata failed' }); mock.enqueue(null); mock.remove.mockResolvedValueOnce({ data: [], error: { message: 'cleanup failed' } })
    await expect(uploadDocument('organization', 'o', 'u', file(), 'support')).rejects.toMatchObject({ code: 'orphan', scope: 'organization', objectPath: expect.stringMatching(/^o\//) })
  })
  it('does not delete an object after an ambiguous metadata response that committed', async () => {
    mock.enqueue(null, { message: 'network error' }); mock.enqueue({ id: 'd' })
    await expect(uploadDocument('student', 's', 'u', file(), 'CV')).resolves.toBeUndefined(); expect(mock.remove).not.toHaveBeenCalled()
  })
  it('cleanup first checks whether metadata exists and protects recorded files', async () => {
    mock.enqueue({ id: 'd' }); await cleanupUpload('student', 's/d/cv.pdf'); expect(mock.remove).not.toHaveBeenCalled()
    mock.enqueue(null); await cleanupUpload('student', 's/d/orphan.pdf'); expect(mock.remove).toHaveBeenCalledWith(['s/d/orphan.pdf'])
  })
  it('requests a new 60-second signed URL for every access', async () => {
    await documentUrl('student', document); await documentUrl('student', document)
    expect(mock.createSignedUrl).toHaveBeenCalledTimes(2); expect(mock.createSignedUrl).toHaveBeenCalledWith('s/d/cv.pdf', 60)
  })
  it('propagates signing errors without exposing internal diagnostics', async () => {
    mock.createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: '' }, error: { message: 'private internal' } })
    await expect(documentUrl('organization', document)).rejects.toThrow('Document unavailable')
  })
  it('retains metadata if Storage deletion fails, and surfaces partial deletion', async () => {
    mock.remove.mockResolvedValueOnce({ data: [], error: { message: 'failed' } })
    await expect(deleteDocument('student', 's', document)).rejects.toThrow(); expect(mock.calls).toHaveLength(0)
    mock.enqueue(null, { message: 'db failed' }); await expect(deleteDocument('student', 's', document)).rejects.toMatchObject({ code: 'partial-delete' })
    mock.enqueue({ id: 'd' }); await expect(deleteDocument('student', 's', document)).resolves.toBeUndefined()
  })
})
