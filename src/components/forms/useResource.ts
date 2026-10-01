import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../lib/supabase/feature-helpers'
export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const reload = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setError('')
    try { const result = await loader(); if (current === generation.current) setData(result) }
    catch (cause) { if (current === generation.current) setError(errorMessage(cause)) }
    finally { if (current === generation.current) setLoading(false) }
  }, [loader])
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) { setData(null); void reload() } }); return () => { active = false; generation.current += 1 } }, [reload])
  return { data, loading, error, reload }
}
