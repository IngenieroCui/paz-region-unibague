/** Keep Auth/data failures actionable; matching and uploads need a longer budget. */
export function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const longRequest = url.pathname.startsWith('/functions/v1/') || url.pathname.startsWith('/storage/v1/')
  const deadline = AbortSignal.timeout(longRequest ? 120_000 : 20_000)
  const original = init?.signal ?? (input instanceof Request ? input.signal : null)
  const signal = original ? AbortSignal.any([original, deadline]) : deadline
  return fetch(input, { ...init, signal })
}
