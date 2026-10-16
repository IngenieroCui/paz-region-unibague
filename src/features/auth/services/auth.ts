import { getSupabase } from '../../../lib/supabase/client'
import { roles, rolePaths } from '../../../config/app'
import type { Role } from '../../../config/app'
import { institutionalEmail } from './access'
async function client() {
  const value = await getSupabase()
  if (!value) throw new Error('Auth unavailable')
  return value
}
export function workspaceForRoles(trustedRoles: readonly Role[]): string {
  if (!trustedRoles.length) return '/unauthorized'
  if (trustedRoles.length > 1) return '/select-role'
  return '/app/' + rolePaths[trustedRoles[0]!]
}
export async function currentRoles(): Promise<Role[]> {
  const { data, error } = await (await client()).rpc('pyr_unibague_current_roles')
  if (error || !Array.isArray(data) || data.some(code => !roles.some(role => role === code))) throw new Error('Role verification failed')
  return roles.filter(role => data.includes(role))
}
export async function currentProfile() {
  const api = await client()
  const { data: { user }, error } = await api.auth.getUser()
  if (error || !user) throw new Error('Session unavailable')
  const result = await api.from('PYRUnibague_UserProfiles').select('*').eq('user_id', user.id).single()
  if (result.error) throw new Error('Profile unavailable')
  return result.data
}
export async function signIn(email: string, password: string) {
  const { error } = await (await client()).auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error('Sign in failed')
}
export async function signOut() {
  const { error } = await (await client()).auth.signOut()
  if (error) throw new Error('Sign out failed')
}
export async function recoverPassword(email: string) {
  // Estas nueve direcciones ficticias nunca acreditaron control del buzón.
  if (/^pyrprueba\.(?:estudiante[2-4]?@estudiantesunibague\.edu\.co|(?:administrador|asesor2?|entidad2?)@unibague\.edu\.co)$/i.test(email.trim())) throw new Error('Las cuentas TEST requieren administración local de credenciales.')
  const { error } = await (await client()).auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/auth/callback' })
  if (error) throw new Error('Recovery failed')
}
export async function updatePassword(password: string) {
  const { error } = await (await client()).auth.updateUser({ password })
  if (error) throw new Error('Password update failed')
}
// Single flight avoids consuming a one-use PKCE code twice under React StrictMode.
let callbackFlight: { code: string; promise: Promise<boolean> } | undefined
export function completeCallback(search: string): Promise<boolean> {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  if (!code || params.has('error') || params.has('error_code')) return Promise.reject(new Error('Invalid callback'))
  if (callbackFlight?.code === code) return callbackFlight.promise
  const promise = (async () => {
    const flowId = params.get('sb_flow_id')
    const api = await client()
    let recovery = false
    const { data: { subscription } } = api.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') recovery = true
    })
    try {
      const { data, error } = await api.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      if (error || !data.session) throw new Error('Invalid callback')
      if (!recovery && params.get('flow') === 'institutional') {
        const result = await api.auth.getUser()
        const user = result.data.user
        const verified = user?.identities?.some(identity => identity.provider === 'google' && identity.identity_data?.email_verified === true && String(identity.identity_data?.email).toLowerCase() === user.email?.toLowerCase())
        if (result.error || !user?.email || !user.email_confirmed_at || !institutionalEmail(user.email) || user.email.toLowerCase().startsWith('pyrprueba.') || !verified) {
          await api.auth.signOut(); throw new Error('Invalid institutional identity')
        }
      }
      return recovery
    } finally { subscription.unsubscribe() }
  })()
  callbackFlight = { code, promise }
  return promise
}
