import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button, IconButton } from '../ui/Button'
import { readPreference, writePreference } from '../../utils/storage'
interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const dismissKey = 'pyr:pwa-dismissed:v1'
const cooldown = 7 * 24 * 60 * 60 * 1000
export function InstallPWA() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    function receive(event: Event) {
      event.preventDefault()
      const dismissed = Number(readPreference(dismissKey))
      const installed = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone
      if (installed || (dismissed > 0 && Date.now() - dismissed < cooldown)) return
      setPrompt(event as InstallPrompt)
    }
    function installed() { setPrompt(null); setError(false) }
    window.addEventListener('beforeinstallprompt', receive)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', receive)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])
  function dismiss() { writePreference(dismissKey, String(Date.now())); setPrompt(null); setError(false) }
  async function install() {
    if (!prompt) return
    setLoading(true)
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice.outcome === 'dismissed') writePreference(dismissKey, String(Date.now()))
      setPrompt(null)
    } catch { setPrompt(null); setError(true) }
    finally { setLoading(false) }
  }
  if (!prompt && !error) return null
  return <aside className="pwa-notice" aria-label="Instalación de la aplicación">
    <Download size={22} aria-hidden="true" /><div><strong>{error ? 'No pudimos iniciar la instalación' : 'Paz y Región, más cerca'}</strong>
      <p role={error ? 'alert' : undefined}>{error ? 'Puedes intentarlo desde el menú de tu navegador.' : 'Añade la plataforma a tu dispositivo para acceder más fácilmente. Los datos requieren conexión.'}</p></div>
    {prompt && <Button loading={loading} onClick={install}>Instalar</Button>}
    <IconButton label="Posponer instalación" onClick={dismiss}><X size={20} aria-hidden="true" /></IconButton></aside>
}
