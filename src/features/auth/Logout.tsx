import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { signOut } from './services/auth'
export function Logout() {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  async function logout() {
    setPending(true); setError(false)
    try { await signOut(); navigate('/login', { replace: true }) }
    catch { setError(true) }
    finally { setPending(false) }
  }
  return <div><Button variant="ghost" loading={pending} onClick={logout}>Cerrar sesión</Button>
    {error && <span role="alert">No pudimos cerrar sesión. Intenta nuevamente.</span>}</div>
}
