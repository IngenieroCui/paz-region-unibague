import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../lib/supabase/feature-helpers'
export function useResource<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<{ loader: typeof loader; data: T | null; loading: boolean; error: string }>({loader,data:null,loading:true,error:''})
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const current = ++generation.current
    setState(previous => ({loader,data:previous.loader===loader?previous.data:null,loading:true,error:''}))
    try { const data = await loader(); if (current === generation.current) setState({ loader, data, loading:false, error:'' }) }
    catch (cause) { if (current === generation.current) setState(previous=>({...previous,loading:false,error:errorMessage(cause)})) }
  }, [loader])
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload() }); return () => { active = false; generation.current += 1 } }, [reload])
  // A changed loader represents a different owner/filter. Hide old data during render,
  // including the frame before effects run. Reloading the same resource keeps valid data.
  const same = state.loader === loader
  const data = same ? state.data : null
  const loading = same ? state.loading : true
  return { data, loading, refreshing: loading && data !== null, error:same?state.error:'', reload }
}
