import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { usePaged } from '../../components/forms/usePaged'
import { PagedResults } from '../../components/forms/PagedData'
import { PageHeader } from '../../components/layout/Headers'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Fields'
import { Alert } from '../../components/feedback/States'
import { errorMessage } from '../../lib/supabase/feature-helpers'
import { listNotifications, markNotificationRead, notificationPath } from './services'

export function NotificationsWorkspace() {
  const { session } = useAuth(), [unread, setUnread] = useState(false)
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  const [message, setMessage] = useState(''), status = useRef<HTMLParagraphElement>(null)
  const userId = session?.user.id ?? ''
  const resource = usePaged(useCallback((page: number) => listNotifications(userId, page, unread), [userId, unread]))
  async function mark(id: string) {
    setBusy(id); setError(''); setMessage('')
    try { await markNotificationRead(id); await resource.reload(); setMessage('Notificación marcada como leída.'); status.current?.focus() }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy('') }
  }
  return <div className="module-stack"><PageHeader title="Mis notificaciones" description="Avisos personales de cambios confirmados en la plataforma." />
    <Checkbox label="Solo sin leer" checked={unread} disabled={!!busy} onChange={event => { setUnread(event.target.checked); resource.setPage(0) }} />
    <Button variant="secondary" disabled={!!busy} onClick={() => void resource.reload()}>Actualizar notificaciones</Button>
    <p role="status" ref={status} tabIndex={-1}>{message}</p>
    {error && <Alert tone="error" title={error} />}
    <PagedResults {...resource} loading={resource.loading || !!busy} count={resource.data?.count ?? 0}><div className="module-stack">{resource.data?.rows.map(row => {
      const path = notificationPath(row.link_path)
      return <Card key={row.id}><h2>{row.title}</h2><p>{row.read_at ? 'Leída' : 'Sin leer'} · {new Date(row.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>{row.body && <p>{row.body}</p>}
        <div className="module-actions">{path && <Link className="button button--secondary" to={path}>Consultar recurso</Link>}{!row.read_at && <Button disabled={!!busy} onClick={() => void mark(row.id)}>{busy === row.id ? 'Guardando…' : 'Marcar como leída'}</Button>}</div>
      </Card>
    })}</div></PagedResults>
  </div>
}
