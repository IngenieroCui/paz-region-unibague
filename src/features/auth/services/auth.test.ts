import { beforeEach, expect, it, vi } from 'vitest'
import { signIn, signOut, recoverPassword, updatePassword, completeCallback, currentRoles, workspaceForRoles } from './auth'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), exchangeCodeForSession: vi.fn(), unsubscribe: vi.fn(), listener: undefined as undefined | ((event: string) => void) }))
vi.mock('../../../lib/supabase/client', () => ({ getSupabase: async () => ({ rpc: mocks.rpc, auth: { ...mocks,
  onAuthStateChange: (listener: typeof mocks.listener) => { mocks.listener = listener; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } },
} }) }))
beforeEach(() => { vi.clearAllMocks(); for (const method of [mocks.signInWithPassword, mocks.signOut, mocks.resetPasswordForEmail, mocks.updateUser]) method.mockResolvedValue({ error: null }) })
it('uses official Auth calls and an origin-bound callback', async () => {
  await signIn(' me@example.org ', 'password'); await signOut(); await recoverPassword(' me@example.org '); await updatePassword('newpassword')
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'me@example.org', password: 'password' })
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith('me@example.org', { redirectTo: window.location.origin + '/auth/callback' })
  expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'newpassword' })
})
it('never sends recovery email to the nine fictitious institutional identities', async () => {
  const accounts = ['estudiante','estudiante2','estudiante3','estudiante4'].map(name => `${name}@estudiantesunibague.edu.co`)
  accounts.push(...['administrador','asesor','asesor2','entidad','entidad2'].map(name => `${name}@unibague.edu.co`))
  for (const account of accounts) await expect(recoverPassword(' PYRPRUEBA.' + account.toUpperCase() + ' ')).rejects.toThrow('TEST')
  expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled()
})
it('exchanges a PKCE code once, derives recovery from the SDK event, ignores next', async () => {
  mocks.exchangeCodeForSession.mockImplementation(async () => { mocks.listener?.('PASSWORD_RECOVERY'); return { data: { session: {} }, error: null } })
  await expect(completeCallback('?code=recovery-code&next=//evil.example')).resolves.toBe(true)
  await completeCallback('?code=recovery-code')
  expect(mocks.exchangeCodeForSession).toHaveBeenCalledOnce()
  expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('recovery-code', undefined)
  expect(mocks.unsubscribe).toHaveBeenCalledOnce()
})
it('rejects missing/error callbacks without exchanging credentials', async () => {
  await expect(completeCallback('?next=https://evil.example')).rejects.toThrow()
  await expect(completeCallback('?error=invalid&code=bad')).rejects.toThrow()
  expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled()
})
it('rejects failed exchanges instead of accepting an existing session', async () => {
  mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: new Error('expired') })
  await expect(completeCallback('?code=expired-code')).rejects.toThrow()
})
it('resolves 0/1/multiple roles and deduplicates trusted codes', async () => {
  expect(workspaceForRoles([])).toBe('/unauthorized')
  expect(workspaceForRoles(['ORGANIZATION'])).toBe('/app/organization')
  expect(workspaceForRoles(['ADMIN','STUDENT'])).toBe('/select-role')
  mocks.rpc.mockResolvedValue({ data: ['ADMIN','ADMIN'], error: null })
  expect(await currentRoles()).toEqual(['ADMIN'])
})
it('accepts ADVISOR only from the persisted-role RPC and preserves multirole selection', async () => {
  mocks.rpc.mockResolvedValue({ data: ['ADVISOR'], error: null })
  expect(await currentRoles()).toEqual(['ADVISOR'])
  expect(workspaceForRoles(['ADVISOR'])).toBe('/app/advisor')
  expect(workspaceForRoles(['ADMIN', 'ADVISOR'])).toBe('/select-role')
  mocks.rpc.mockResolvedValue({ data: ['COORDINATOR'], error: null })
  await expect(currentRoles()).rejects.toThrow('verification')
})
