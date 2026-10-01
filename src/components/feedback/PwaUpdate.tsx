import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button'
export function PwaUpdate() {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(false)
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  async function update() {
    setUpdating(true)
    try { await updateServiceWorker(true) } catch { setError(true); setUpdating(false) }
  }
  if (!needRefresh) return null
  return <aside className="pwa-update" aria-label="Actualización de la aplicación"><div><strong>Hay una nueva versión disponible</strong>
    <p role={error ? 'alert' : undefined}>{error ? 'No pudimos actualizar. Comprueba tu conexión e intenta nuevamente.' : 'Guarda cualquier cambio antes de actualizar.'}</p></div>
    <Button loading={updating} onClick={update}>Actualizar</Button><Button variant="secondary" onClick={() => setNeedRefresh(false)}>Más tarde</Button></aside>
}
