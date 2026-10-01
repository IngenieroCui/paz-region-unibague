import { createContext, useContext, useEffect } from 'react'
export const UnsavedContext = createContext<(id: string, dirty: boolean) => void>(() => {})
export function useUnsavedChanges(id: string, dirty: boolean) {
  const update = useContext(UnsavedContext)
  useEffect(() => { update(id, dirty); return () => update(id, false) }, [id, dirty, update])
}
