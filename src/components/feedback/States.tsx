import type { ReactNode } from 'react'
import { CircleAlert, FolderOpen, LoaderCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import type { Tone } from '../ui/Badge'
export function Alert({ title, children, tone = 'info' }: { title: string; children?: ReactNode; tone?: Tone }) {
  return <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <CircleAlert size={20} aria-hidden="true" /><div><strong>{title}</strong>{children && <p>{children}</p>}</div></div>
}
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><FolderOpen size={32} aria-hidden="true" /><h3>{title}</h3><p>{children}</p></div>
}
export function ErrorState({ title = 'No pudimos cargar esta información', onRetry }: { title?: string; onRetry?: () => void }) {
  return <div className="empty-state" role="alert"><CircleAlert size={32} aria-hidden="true" /><h3>{title}</h3>
    <p>Intenta nuevamente en unos momentos.</p>{onRetry && <Button onClick={onRetry}>Reintentar</Button>}</div>
}
export function LoadingState() {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" aria-hidden="true" />Cargando el espacio…</div>
}
