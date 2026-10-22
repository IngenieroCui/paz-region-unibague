import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert, LoadingState } from '../../components/feedback/States'
import { completeCallback } from './services/auth'
export default function AuthCallback() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    // Capture code before removing it from browser history. Never use next/redirect query parameters.
    window.history.replaceState(window.history.state, '', '/auth/callback')
    void completeCallback(search).then(recovery => {
      if (active) navigate(recovery ? '/reset-password' : new URLSearchParams(search).get('flow') === 'organization' ? '/registro/organizacion' : '/select-role', { replace: true })
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [search, navigate])
  return <section className="status-page"><h1>Verificando tu acceso</h1>{error ? <>
    <Alert tone="error" title="El enlace no es válido o expiró">Solicita nuevas instrucciones para continuar.</Alert>
    <Link className="button button--primary" to="/forgot-password">Solicitar recuperación</Link>
    <Link className="text-link" to="/login">Volver al acceso</Link>
  </> : <LoadingState />}</section>
}
