import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useUnsavedChanges } from './unsaved-context'
import { Button } from '../ui/Button'
import { Alert } from '../feedback/States'
import { errorMessage } from '../../lib/supabase/feature-helpers'

export function Editor({ children, onSave, label = 'Guardar cambios', readOnly = false, resetOnSave = false, successTitle = 'Cambios guardados' }: { children: ReactNode; onSave: (form: FormData) => Promise<void>; label?: string; readOnly?: boolean; resetOnSave?: boolean; successTitle?: string }) {
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  useUnsavedChanges(useId(), dirty || busy)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setBusy(true); setError(''); setSuccess(false)
    try { await onSave(form); if (resetOnSave && formElement.isConnected) formElement.reset(); setDirty(false); setSuccess(true) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }
  return <form className="module-form" onSubmit={submit} onChange={() => { setDirty(true); setSuccess(false) }}>
    <fieldset disabled={busy}>{children}</fieldset>
    {error && <Alert tone="error" title={error} />}
    {success && <Alert tone="success" title={successTitle} />}
    {!readOnly && <Button type="submit" loading={busy}>{label}</Button>}
  </form>
}

export function ConfirmDialog({ open, title, children, onCancel, onConfirm, confirmLabel = 'Eliminar' }: { open: boolean; title: string; children: ReactNode; onCancel: () => void; onConfirm: () => Promise<void>; confirmLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { queueMicrotask(() => setError('')); ref.current?.showModal() } else if (ref.current?.open) ref.current.close() }, [open])
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id={id}>{title}</h2><p>{children}</p>{error && <Alert tone="error" title={error} />}
    <div className="module-actions"><Button autoFocus variant="secondary" disabled={busy} onClick={onCancel}>Cancelar</Button>
      <Button loading={busy} onClick={async () => { setBusy(true); setError(''); try { await onConfirm(); onCancel() } catch (cause) { setError(errorMessage(cause)) } finally { setBusy(false) } }}>{confirmLabel}</Button></div>
  </dialog>
}
