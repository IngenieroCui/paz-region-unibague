import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { InstitutionalMark } from '../../components/layout/Brand'
import { Alert, LoadingState } from '../../components/feedback/States'
import { Checkbox, Input } from '../../components/ui/Fields'
import { Button } from '../../components/ui/Button'
import { useAuth } from './auth-context'
import { registrationAvailable, registrationPolicyLinks, registerResponsible, startExternalOnboarding } from './services/access'
import { workspaceForRoles } from './services/auth'

type Turnstile = { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string; remove: (id: string) => void }
function RegistrationCaptcha({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let widget: string | undefined
    let active = true
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true
    script.onload = () => {
      const api = (window as Window & { turnstile?: Turnstile }).turnstile
      if (active && container.current && api) widget = api.render(container.current, { sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY!, callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') })
    }
    script.onerror = () => onToken('')
    document.head.append(script)
    return () => { active = false; if (widget) (window as Window & { turnstile?: Turnstile }).turnstile?.remove(widget); script.remove() }
  }, [onToken])
  return <div ref={container} aria-label="Verificación de seguridad" />
}
export default function OrganizationRegistration() {
  const auth = useAuth()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaVersion, setCaptchaVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const policies = registrationPolicyLinks()
  useEffect(() => {
    let active = true
    void registrationAvailable().then(value => { if (active) setReady(value) }).catch(() => {}).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [])
  if (auth.recovery) return <Navigate to="/reset-password" replace />
  if (auth.status === 'authenticated' && auth.roles.length) return <Navigate to={workspaceForRoles(auth.roles)} replace />
  return <section className="registration-panel"><InstitutionalMark /><p className="eyebrow">Organizaciones · Paz y Región</p><h1>Registra tu organización</h1>
    <ol className="registration-steps" aria-label="Etapas del registro"><li>Cuenta y correo</li><li>Organización</li><li>Contactos</li><li>Documentos</li><li>Revisión de coordinación</li></ol>
    {checking ? <LoadingState /> : !ready && <Alert title="Registro público pendiente de activación">La Universidad debe habilitar la entrega y confirmación de correo y los controles de registro. El registro desde esta pantalla permanece cerrado. Si ya tienes una cuenta autorizada, puedes ingresar y completar tu organización.</Alert>}
    <p>La confirmación del correo acredita tu cuenta. La aprobación de la organización corresponde a coordinación y se realiza por separado.</p>
    {error && <Alert tone="error" title={error} />}
    {auth.session ? <><p>Cuenta responsable: {auth.session.user.email}</p>{ready && <Button loading={busy} onClick={async () => {
      setBusy(true); setError('')
      try { await startExternalOnboarding() } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos continuar.') } finally { setBusy(false) }
    }}>Continuar con la solicitud de organización</Button>}</> : success ? <Alert tone="success" title="Solicitud recibida">Si la dirección puede registrarse, recibirás un enlace para confirmar tu correo. Ábrelo en este navegador y después ingresa para continuar. Si ya tienes cuenta, utiliza el acceso o la recuperación de contraseña.</Alert> : <form className="auth-form" onSubmit={async event => {
      event.preventDefault(); if (!ready || busy) return
      const form = event.currentTarget; const data = new FormData(form); const value = (key: string) => String(data.get(key) ?? '')
      if (!data.has('consent')) { setError('Acepta las condiciones y el tratamiento de datos para continuar.'); return }
      setBusy(true); setError('')
      try { await registerResponsible({ firstName: value('firstName'), lastName: value('lastName'), email: value('email'), password: value('password'), confirmation: value('confirmation'), captchaToken }); setSuccess(true); form.reset() }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos recibir la solicitud.'); setCaptchaToken(''); setCaptchaVersion(value => value + 1) } finally { setBusy(false) }
    }}><fieldset disabled={!ready || busy}><legend>1. Usuario responsable</legend><div className="form-grid"><Input label="Nombre" name="firstName" autoComplete="given-name" required maxLength={100} /><Input label="Apellidos" name="lastName" autoComplete="family-name" required maxLength={100} /></div>
      <Input label="Correo de contacto" name="email" type="email" autoComplete="email" required maxLength={254} hint="Usa un correo externo real al que tengas acceso." />
      <Input label="Contraseña" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint="Mínimo 12 caracteres." /><Input label="Confirma la contraseña" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      {policies ? <><p>Consulta las <a href={policies.terms} target="_blank" rel="noopener noreferrer">condiciones institucionales</a> y la <a href={policies.privacy} target="_blank" rel="noopener noreferrer">política de tratamiento de datos</a>.</p><Checkbox label="Acepto las condiciones institucionales y el tratamiento de datos" name="consent" required /></> : <p className="workspace-note">El texto autorizado de tratamiento de datos y condiciones institucionales está pendiente de entrega por la Universidad. El registro permanecerá cerrado hasta su aprobación.</p>}
      {ready && <RegistrationCaptcha key={captchaVersion} onToken={setCaptchaToken} />}<Button type="submit" loading={busy} disabled={!ready || !captchaToken}>Solicitar cuenta y confirmar correo</Button>
    </fieldset></form>}
    <Link className="button button--secondary" to="/login/organizaciones">Ya tengo una cuenta · Ingresar</Link><Link className="text-link" to="/login">Volver a la selección de acceso</Link>
  </section>
}
