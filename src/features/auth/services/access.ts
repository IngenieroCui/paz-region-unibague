import { supabaseConfiguration } from '../../../lib/supabase/config'
import { getSupabase } from '../../../lib/supabase/client'

export const institutionalDomains = ['unibague.edu.co', 'estudiantesunibague.edu.co'] as const
export function institutionalEmail(email: string) {
  const host = email.trim().toLowerCase().split('@')[1]
  return institutionalDomains.some(domain => host === domain || host?.endsWith('.' + domain))
}
export function registrationPolicyLinks() {
  try {
    const terms = new URL(import.meta.env.VITE_REGISTRATION_TERMS_URL ?? '')
    const privacy = new URL(import.meta.env.VITE_REGISTRATION_PRIVACY_URL ?? '')
    if ([terms, privacy].some(url => url.protocol !== 'https:' || url.username || url.password)) return null
    return { terms: terms.href, privacy: privacy.href }
  } catch { return null }
}
export async function googleAvailable(): Promise<boolean> {
  if (import.meta.env.VITE_INSTITUTIONAL_GOOGLE_ENABLED !== 'true' || supabaseConfiguration.status !== 'ready') return false
  const { url, key } = supabaseConfiguration
  const response = await fetch(new URL('/auth/v1/settings', url), { headers: { apikey: key }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) return false
  const settings = await response.json() as { external?: { google?: boolean } }
  return settings.external?.google === true
}
export async function signInInstitutional() {
  if (!await googleAvailable()) throw new Error('Google institucional pendiente de activación')
  const api = await getSupabase()
  if (!api) throw new Error('Auth unavailable')
  const { error } = await api.auth.signInWithOAuth({ provider: 'google', options: {
    redirectTo: window.location.origin + '/auth/callback?flow=institutional',
    queryParams: { prompt: 'select_account' },
  } })
  if (error) throw new Error('No pudimos iniciar el acceso institucional')
}
export async function registrationAvailable(): Promise<boolean> {
  if (import.meta.env.VITE_EXTERNAL_REGISTRATION_ENABLED !== 'true' || !import.meta.env.VITE_TURNSTILE_SITE_KEY || !registrationPolicyLinks() || supabaseConfiguration.status !== 'ready') return false
  const api = await getSupabase()
  if (!api) return false
  const { data, error } = await api.rpc('pyr_unibague_external_registration_ready')
  if (error || data !== true) return false
  const { url, key } = supabaseConfiguration
  const response = await fetch(new URL('/auth/v1/settings', url), { headers: { apikey: key }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) return false
  const settings = await response.json() as { disable_signup?: boolean; mailer_autoconfirm?: boolean; external?: { email?: boolean } }
  return settings.disable_signup === false && settings.mailer_autoconfirm === false && settings.external?.email === true
}
// Only a convenience throttle. Auth rate limits, CAPTCHA and the database gate are mandatory.
let nextAttempt = 0
export async function registerResponsible(input: { firstName: string; lastName: string; email: string; password: string; confirmation: string; captchaToken: string }) {
  const { firstName, lastName, email, password, confirmation, captchaToken } = input
  if (!firstName.trim() || !lastName.trim() || firstName.length > 100 || lastName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254 || institutionalEmail(email) || password.length < 12 || password.length > 128 || password !== confirmation || !captchaToken) throw new Error('Revisa los datos, la contraseña y la verificación de seguridad.')
  if (Date.now() < nextAttempt) throw new Error('Espera un minuto antes de intentar nuevamente.')
  nextAttempt = Date.now() + 60000
  if (!await registrationAvailable()) throw new Error('El registro público está pendiente de activación institucional.')
  const api = await getSupabase()
  if (!api) throw new Error('Auth unavailable')
  const { data, error } = await api.auth.signUp({ email: email.trim(), password, options: {
    emailRedirectTo: window.location.origin + '/auth/callback?flow=organization', captchaToken,
    data: { display_name: `${firstName.trim()} ${lastName.trim()}` },
  } })
  if (data.session) { await api.auth.signOut(); throw new Error('La confirmación de correo debe estar activada.') }
  // Existing accounts and successful requests receive the same response.
  if (error && !['user_already_exists', 'email_exists'].includes(error.code ?? '')) throw new Error('No pudimos recibir la solicitud. Intenta más tarde.')
}
export async function startExternalOnboarding() {
  const api = await getSupabase()
  if (!api) throw new Error('Auth unavailable')
  const { error } = await api.rpc('pyr_unibague_start_external_onboarding')
  if (error) throw new Error('No pudimos habilitar tu solicitud. Verifica tu correo o consulta con coordinación.')
  // Refresh the single AuthProvider so it reloads the persisted ORGANIZATION role.
  const refresh = await api.auth.refreshSession()
  if (refresh.error) throw new Error('Vuelve a ingresar para continuar.')
}
