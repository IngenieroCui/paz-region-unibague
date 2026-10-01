import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, LoadingState } from '../../components/feedback/States'
import { Input } from '../../components/ui/Fields'
import { Button } from '../../components/ui/Button'
import { useAuth } from './auth-context'
import { updatePassword, signOut } from './services/auth'
export default function ResetPassword() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !auth.session || !auth.recovery) return
    if (password.length < 8 || password !== confirmation) { setError('Usa al menos 8 caracteres y confirma la misma contraseña.'); return }
    setPending(true); setError('')
    try {
      await updatePassword(password)
      setSuccess(true); setPassword(''); setConfirmation('')
      await signOut()
    } catch { setError('No pudimos completar la operación. Intenta nuevamente. Si ya cambiaste la contraseña, vuelve a ingresar.') }
    finally { setPending(false) }
  }
  if (auth.status === 'loading' && !auth.recovery) return <LoadingState />
  return <section className="auth-panel"><h1>Define una nueva contraseña</h1>
    {success ? <><Alert tone="success" title="Contraseña actualizada">Ya puedes ingresar con tu nueva contraseña.</Alert><Link to="/login">Volver a ingresar</Link></> :
    !auth.session || !auth.recovery ? <><Alert title="Solicita un enlace de recuperación">Necesitas un enlace válido para cambiar tu contraseña.</Alert><Link to="/forgot-password">Recuperar acceso</Link></> :
    <form className="auth-form" onSubmit={submit}>
      <Input label="Nueva contraseña" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} disabled={pending} />
      <Input label="Confirma la contraseña" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={pending} />
      <Button type="submit" loading={pending}>Guardar contraseña</Button>
    </form>}
    {error && <Alert tone="error" title="Revisa el cambio">{error}</Alert>}
  </section>
}
