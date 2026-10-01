import { vi } from 'vitest'
type Response = { data: unknown; error: { message: string; code?: string } | null; count?: number }
export function mockFeatureClient() {
  const responses: Response[] = []
  const calls: { table: string; operation: string; args: unknown[] }[] = []
  const enqueue = (data: unknown = null, error: Response['error'] = null, count?: number) => { responses.push({ data, error, count }) }
  const from = vi.fn((table: string) => {
    const response = responses.shift() ?? { data: null, error: null }
    const chain: Record<string, unknown> = {}
    for (const operation of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'ilike', 'or', 'not', 'is', 'gte', 'lt', 'order', 'range', 'single', 'maybeSingle']) chain[operation] = (...args: unknown[]) => { calls.push({ table, operation, args }); return chain }
    chain.then = (resolve: (value: Response) => void) => Promise.resolve(response).then(resolve)
    return chain
  })
  const upload = vi.fn(async () => ({ data: {}, error: null as Response['error'] }))
  const remove = vi.fn(async () => ({ data: [], error: null as Response['error'] }))
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://storage.example.test/temporary' }, error: null as Response['error'] }))
  const storageFrom = vi.fn(() => ({ upload, remove, createSignedUrl }))
  const rpc = vi.fn(async (_name: string, _args: unknown) => responses.shift() ?? { data: null, error: null })
  return { db: { from, storage: { from: storageFrom }, rpc }, calls, enqueue, upload, remove, createSignedUrl, rpc, storageFrom }
}
