import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { googleAvailable, institutionalEmail, registerResponsible, registrationAvailable, registrationPolicyLinks, signInInstitutional, startExternalOnboarding } from './access'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), signInWithOAuth: vi.fn(), refreshSession: vi.fn() }))
vi.mock('../../../lib/supabase/config', () => ({ supabaseConfiguration: { status: 'ready', url: 'https://pyr-e2e.example.test', key: 'sb_publishable_fixture' } }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: async () => ({ rpc: mocks.rpc, auth: mocks }) }))
let clock = Date.now()
beforeEach(() => {
  vi.clearAllMocks(); clock += 120000; vi.spyOn(Date, 'now').mockReturnValue(clock)
  vi.stubEnv('VITE_INSTITUTIONAL_GOOGLE_ENABLED','false'); vi.stubEnv('VITE_EXTERNAL_REGISTRATION_ENABLED','false')
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY',''); vi.stubEnv('VITE_REGISTRATION_TERMS_URL',''); vi.stubEnv('VITE_REGISTRATION_PRIVACY_URL','')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true, email: true }, disable_signup: false, mailer_autoconfirm: false }) }))
  mocks.rpc.mockResolvedValue({ data: true, error: null }); mocks.signInWithOAuth.mockResolvedValue({ error: null }); mocks.signUp.mockResolvedValue({ data: { session: null }, error: null }); mocks.signOut.mockResolvedValue({ error: null }); mocks.refreshSession.mockResolvedValue({ error: null })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function enableRegistration() {
  vi.stubEnv('VITE_EXTERNAL_REGISTRATION_ENABLED','true'); vi.stubEnv('VITE_TURNSTILE_SITE_KEY','fixture')
  vi.stubEnv('VITE_REGISTRATION_TERMS_URL','https://institution.example.test/terms'); vi.stubEnv('VITE_REGISTRATION_PRIVACY_URL','https://institution.example.test/privacy')
}
const input = { firstName: 'Ana', lastName: 'Prueba', email: 'ana@external.example.test', password: 'long-test-password', confirmation: 'long-test-password', captchaToken: 'fixture-token' }
it('disables both public signup and OAuth without configured activation', async () => {
  expect(await googleAvailable()).toBe(false); expect(await registrationAvailable()).toBe(false)
  expect(fetch).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
  await expect(signInInstitutional()).rejects.toThrow('pendiente'); expect(mocks.signInWithOAuth).not.toHaveBeenCalled()
  await expect(registerResponsible(input)).rejects.toThrow('pendiente'); expect(mocks.signUp).not.toHaveBeenCalled()
})
it('requires both a verified provider and the institutional activation flag', async () => {
  vi.stubEnv('VITE_INSTITUTIONAL_GOOGLE_ENABLED','true')
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ external: { google: false } }) } as Response)
  await expect(signInInstitutional()).rejects.toThrow(); expect(mocks.signInWithOAuth).not.toHaveBeenCalled()
})
it('starts official Google PKCE OAuth with an origin-bound callback', async () => {
  vi.stubEnv('VITE_INSTITUTIONAL_GOOGLE_ENABLED','true'); await signInInstitutional()
  expect(mocks.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback?flow=institutional', queryParams: { prompt: 'select_account' } } })
})
it.each(['me@unibague.edu.co','me@estudiantesunibague.edu.co','me@sub.unibague.edu.co'])('rejects institutional self signup for %s', async email => {
  expect(institutionalEmail(email)).toBe(true); await expect(registerResponsible({ ...input, email })).rejects.toThrow('Revisa'); expect(mocks.signUp).not.toHaveBeenCalled()
})
it('does not mistake a similar external domain for an institutional domain', () => { expect(institutionalEmail('me@unibague.edu.co.external.test')).toBe(false) })
it('requires authorized HTTPS policy URLs', async () => {
  enableRegistration(); vi.stubEnv('VITE_REGISTRATION_PRIVACY_URL','javascript:alert(1)')
  expect(registrationPolicyLinks()).toBeNull(); expect(await registrationAvailable()).toBe(false)
})
it('fails closed if the migration or server authorization is unavailable', async () => {
  enableRegistration(); mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
  expect(await registrationAvailable()).toBe(false); expect(fetch).not.toHaveBeenCalled()
})
it('refuses signup when hosted Auth automatically confirms emails', async () => {
  enableRegistration(); vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ external: { email: true }, disable_signup: false, mailer_autoconfirm: true }) } as Response)
  await expect(registerResponsible(input)).rejects.toThrow('pendiente'); expect(mocks.signUp).not.toHaveBeenCalled()
})
it('requires matching strong passwords and CAPTCHA', async () => {
  for (const update of [{ confirmation: 'mismatch' },{ password: 'short' },{ captchaToken: '' }]) await expect(registerResponsible({ ...input, ...update })).rejects.toThrow('Revisa')
  expect(mocks.signUp).not.toHaveBeenCalled()
})
it('requests email confirmation without any role metadata and throttles retries', async () => {
  enableRegistration(); await registerResponsible(input)
  expect(mocks.signUp).toHaveBeenCalledWith({ email: input.email, password: input.password, options: { captchaToken: 'fixture-token', emailRedirectTo: window.location.origin + '/auth/callback?flow=organization', data: { display_name: 'Ana Prueba' } } })
  await expect(registerResponsible(input)).rejects.toThrow('minuto'); expect(mocks.signUp).toHaveBeenCalledOnce()
})
it('does not enumerate an existing account', async () => {
  enableRegistration(); mocks.signUp.mockResolvedValue({ data: { session: null }, error: { code: 'user_already_exists' } })
  await expect(registerResponsible(input)).resolves.toBeUndefined()
})
it('coalesces rapid registration attempts before the asynchronous preflight', async () => {
  enableRegistration()
  const results = await Promise.allSettled([registerResponsible(input), registerResponsible(input)])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1); expect(mocks.signUp).toHaveBeenCalledOnce()
})
it('discards an unexpected automatically confirmed session', async () => {
  enableRegistration(); mocks.signUp.mockResolvedValue({ data: { session: {} }, error: null })
  await expect(registerResponsible(input)).rejects.toThrow('confirmación'); expect(mocks.signOut).toHaveBeenCalledOnce()
})
it('starts onboarding through the restricted RPC and refreshes persisted roles', async () => {
  await startExternalOnboarding(); expect(mocks.rpc).toHaveBeenCalledWith('pyr_unibague_start_external_onboarding'); expect(mocks.refreshSession).toHaveBeenCalledOnce()
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } }); await expect(startExternalOnboarding()).rejects.toThrow('Verifica')
})
