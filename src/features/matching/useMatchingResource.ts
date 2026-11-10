import { useEffect, useState } from 'react'
import { errorMessage } from '../../lib/supabase/feature-helpers'
/** Caller supplies a stable callback. Late responses after filter/session changes are discarded. */
export function useMatchingResource<T>(loader: () => Promise<T>, enabled = true) {
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<{ loader: typeof loader; revision: number; data: T | null; loading: boolean; error: string }>({ loader, revision: reloadKey, data: null, loading: enabled, error: '' })
  useEffect(() => {
    let current = true
    const identity = { loader, revision: reloadKey }
    if (!enabled) { queueMicrotask(() => { if (current) setState({ ...identity, data: null, loading: false, error: '' }) }); return () => { current = false } }
    queueMicrotask(() => { if (current) setState({ ...identity, data: null, loading: true, error: '' }) })
    Promise.resolve().then(loader).then(data => { if (current) setState({ ...identity, data, loading: false, error: '' }) }, cause => { if (current) setState({ ...identity, data: null, loading: false, error: errorMessage(cause) }) })
    return () => { current = false }
  }, [loader, enabled, reloadKey])
  // Filters/period/reload change before the effect runs. Never expose the old run in that frame.
  const same = state.loader === loader && state.revision === reloadKey
  return { data: enabled && same ? state.data : null, loading: enabled && (!same || state.loading), error: enabled && same ? state.error : '', reload: () => setReloadKey(key => key + 1) }
}
