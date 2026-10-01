import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useBlocker } from 'react-router-dom'
import { ConfirmDialog } from './Editor'
import { UnsavedContext } from './unsaved-context'
export function UnsavedChanges({ children }: { children: ReactNode }) {
  const [forms, setForms] = useState<Set<string>>(() => new Set())
  const update = useCallback((id: string, dirty: boolean) => setForms(previous => {
    if (previous.has(id) === dirty) return previous
    const next = new Set(previous); if (dirty) next.add(id); else next.delete(id); return next
  }), [])
  const dirty = forms.size > 0
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  return <UnsavedContext.Provider value={update}>{children}<ConfirmDialog open={blocker.state === 'blocked'} title="Hay cambios sin guardar" confirmLabel="Salir sin guardar" onCancel={() => blocker.state === 'blocked' && blocker.reset()} onConfirm={async () => { if (blocker.state === 'blocked') blocker.proceed() }}>Si sales ahora, perderás los cambios de tus formularios.</ConfirmDialog></UnsavedContext.Provider>
}
