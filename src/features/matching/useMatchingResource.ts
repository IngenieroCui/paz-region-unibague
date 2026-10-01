import { useEffect, useState } from 'react'
import { errorMessage } from '../../lib/supabase/feature-helpers'
/** Caller supplies a stable callback. Late responses after filter/session changes are discarded. */
export function useMatchingResource<T>(loader: () => Promise<T>, enabled = true) {
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({ data: null, loading: enabled, error: '' })
  useEffect(() => {
    let current = true
    if (!enabled) { queueMicrotask(() => { if (current) setState({ data: null, loading: false, error: '' }) }); return () => { current = false } }
    queueMicrotask(() => { if (current) setState({ data: null, loading: true, error: '' }) })
    loader().then(data => { if (current) setState({ data, loading: false, error: '' }) }, cause => { if (current) setState({ data: null, loading: false, error: errorMessage(cause) }) })
    return () => { current = false }
  }, [loader, enabled, reloadKey])
  return { ...state, reload: () => setReloadKey(key => key + 1) }
}
