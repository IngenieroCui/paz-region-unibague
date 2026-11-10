import { afterEach, expect, it, vi } from 'vitest'
import { supabaseFetch } from './request'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it.each([['/auth/v1/token', 20_000], ['/rest/v1/rpc/pyr_unibague_current_roles', 20_000], ['/functions/v1/matching-run', 120_000], ['/storage/v1/object/upload', 120_000]])('bounds %s without retrying mutations', async (path, milliseconds) => {
  const deadline = new AbortController()
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
  vi.stubGlobal('fetch', fetch)
  await supabaseFetch('https://demo.example.test' + path, { method: 'POST', body: '{}' })
  expect(timeout).toHaveBeenCalledWith(milliseconds)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: '{}', signal: deadline.signal })
})

it('preserves caller cancellation as well as the deadline', async () => {
  const deadline = new AbortController(), caller = new AbortController()
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
  vi.stubGlobal('fetch', fetch)
  await supabaseFetch(new Request('https://demo.example.test/rest/v1/table', { signal: caller.signal }))
  const signal = fetch.mock.calls[0]?.[1]?.signal
  caller.abort()
  expect(signal?.aborted).toBe(true)
})
