import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { Alert } from '../../components/feedback/States'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Fields'
import { InstitutionalMark } from '../../components/layout/Brand'
import { appConfig } from '../../config/app'
import { supabaseConfiguration } from '../../lib/supabase/config'
import { useAuth } from './auth-context'
import { signIn, recoverPassword, workspaceForRoles } from './services/auth'
import { googleAvailable, signInInstitutional } from './services/access'
export default function AuthPage({ recovery = false, audience = 'institutional' }: { recovery?: boolean; audience?: 'institutional' | 'organization' }) {
  const configured = supabaseConfiguration.status === 'ready'
  const auth = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  useEffect(() => {
    let active = true
    if (!recovery && audience === 'institutional') void googleAvailable().then(ready => { if (active) setGoogleReady(ready) }).catch(() => {})
    return () => { active = false }
  }, [audience, recovery])
  useEffect(() => {
    if (!recovery && auth.status === 'authenticated') navigate(auth.recovery ? '/reset-password' : workspaceForRoles(auth.roles), { replace: true })
  }, [auth.status, auth.roles, auth.recovery, recovery, navigate])
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!configured || pending) return
    setPending(true); setError(''); setSuccess(false)
    try {
      if (recovery) { await recoverPassword(email); setSuccess(true) }
      else await signIn(email, password)
    } catch {
      setError(recovery ? 'No pudimos solicitar la recuperación. Intenta nuevamente.' : 'No pudimos ingresar. Revisa tus credenciales o intenta nuevamente.')
    } finally { setPending(false) }
  }
  return <section className="auth-layout"><div className="auth-story"><p className="eyebrow">{appConfig.name}</p>
    <h2>Tu próximo paso<br />empieza aquí.</h2><p>Un espacio común para la comunidad que participa en Paz y Región.</p>
    <div className="auth-institution"><InstitutionalMark /><span>Universidad de Ibagué<br /><small>Conexión con el territorio</small></span></div>
  </div><div className="auth-panel"><Link className="text-link" to="/login"><ArrowLeft size={17} aria-hidden="true" /> Elegir otro acceso</Link>
    <span className="icon-tile"><LockKeyhole size={22} aria-hidden="true" /></span>
    <h1>{recovery ? 'Recupera tu acceso' : audience === 'institutional' ? 'Acceso comunidad universitaria' : 'Acceso de organizaciones'}</h1>
    {appConfig.demo && <p className="workspace-note">Demostración controlada · Datos TEST. Las cuentas ficticias no utilizan recuperación por correo.</p>}
    <p className="muted">{recovery ? 'Te enviaremos instrucciones para recuperar tu contraseña.' : audience === 'institutional' ? 'Para estudiantes, asesores y coordinación con acceso autorizado.' : 'Ingresa con el correo de contacto de tu organización. Aceptamos correos externos.'}</p>
    {!recovery && audience === 'institutional' && <><Button disabled={!googleReady || pending} onClick={async () => {
      setPending(true); setError('')
      try { await signInInstitutional() } catch { setError('El acceso con Google institucional no está disponible. Utiliza tu cuenta autorizada.') } finally { setPending(false) }
    }}>Continuar con mi cuenta Unibagué</Button>{!googleReady && <p role="status">Google Workspace institucional · Pendiente de activación por la Universidad.</p>}<h2 className="auth-alternative">Acceso transitorio autorizado</h2><p className="muted">Correo y contraseña para cuentas TEST y otras identidades habilitadas por coordinación.</p></>}
    {!configured && <Alert title="Acceso sin configurar">El acceso requiere la configuración de Supabase.</Alert>}
    {(error || (!recovery && auth.status === 'error')) && <Alert tone="error" title="No pudimos completar el acceso">{error || 'No pudimos verificar los permisos de tu cuenta.'}</Alert>}
    {success && <Alert tone="success" title="Solicitud recibida">Si la cuenta permite recuperación, recibirás instrucciones en tu correo.</Alert>}
    <form onSubmit={submit} className="auth-form">
      <Input label="Correo electrónico" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={!configured || pending} />
      {!recovery && <Input label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={!configured || pending} />}
      {!recovery && <Link className="text-link recovery-link" to="/forgot-password">¿Olvidaste tu contraseña?</Link>}
      <Button type="submit" loading={pending || (!recovery && configured && auth.status === 'loading')} disabled={!configured}>{recovery ? 'Enviar instrucciones' : 'Ingresar'}</Button>
    </form>
    {!recovery && audience === 'organization' && <Link className="button button--secondary" to="/registro/organizacion">Registrar mi organización</Link>}
    {recovery && <Link className="text-link" to="/login">Volver a ingresar</Link>}
    <p className="auth-note">Si necesitas ayuda, contacta a la coordinación de Paz y Región por los canales institucionales.</p>
  </div></section>
}
