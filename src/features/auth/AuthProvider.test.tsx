import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), rpc: vi.fn(), unsubscribe: vi.fn(), listener: undefined as undefined | ((event: AuthChangeEvent, session: Session | null) => void) }))
vi.mock('../../lib/supabase/config', () => ({ supabaseConfiguration: { status: 'ready' } }))
vi.mock('../../lib/supabase/client', () => ({ getSupabase: async () => ({ rpc: mocks.rpc, auth: {
  getSession: mocks.getSession,
  onAuthStateChange: (listener: typeof mocks.listener) => { mocks.listener = listener; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } },
} }) }))
const session = { user: { id: 'one', user_metadata: { role: 'ADMIN', roles: ['ADMIN'] } } } as unknown as Session
function Probe() { const auth = useAuth(); return <output>{auth.status}:{auth.roles.join(',')}:{String(auth.recovery)}</output> }
beforeEach(() => { vi.clearAllMocks(); mocks.getSession.mockResolvedValue({ data: { session }, error: null }); mocks.rpc.mockResolvedValue({ data: ['STUDENT'], error: null }) })
it('loads trusted roles only via RPC, refreshes them and clears them on logout', async () => {
  const view = render(<AuthProvider><Probe /></AuthProvider>)
  expect(await screen.findByText('authenticated:STUDENT:false')).toBeInTheDocument()
  expect(mocks.rpc).toHaveBeenCalledWith('pyr_unibague_current_roles')
  mocks.rpc.mockResolvedValue({ data: ['ADMIN', 'STUDENT'], error: null })
  act(() => mocks.listener?.('TOKEN_REFRESHED', session))
  expect(await screen.findByText('authenticated:STUDENT,ADMIN:false')).toBeInTheDocument()
  act(() => mocks.listener?.('SIGNED_OUT', null))
  expect(screen.getByText('anonymous::false')).toBeInTheDocument()
  view.unmount(); expect(mocks.unsubscribe).toHaveBeenCalledOnce()
})
it('denies access after a role lookup failure', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: new Error('denied') })
  render(<AuthProvider><Probe /></AuthProvider>)
  expect(await screen.findByText('error::false')).toBeInTheDocument()
})
it('rejects unknown role payloads', async () => {
  mocks.rpc.mockResolvedValue({ data: ['SUPERUSER'], error: null })
  render(<AuthProvider><Probe /></AuthProvider>)
  expect(await screen.findByText('error::false')).toBeInTheDocument()
})
it('discards a stale role response after logout', async () => {
  let finish: (v: { data: string[]; error: null }) => void = () => {}
  mocks.rpc.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<AuthProvider><Probe /></AuthProvider>)
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalled())
  act(() => mocks.listener?.('SIGNED_OUT', null))
  await act(async () => finish({ data: ['ADMIN'], error: null }))
  expect(screen.getByText('anonymous::false')).toBeInTheDocument()
})
it('handles recovery events even when an account has no workspace role', async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  render(<AuthProvider><Probe /></AuthProvider>)
  await screen.findByText('authenticated::false')
  act(() => mocks.listener?.('PASSWORD_RECOVERY', session))
  expect(await screen.findByText('authenticated::true')).toBeInTheDocument()
})
it('handles session initialization errors', async () => {
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: new Error('session') })
  render(<AuthProvider><Probe /></AuthProvider>)
  expect(await screen.findByText('error::false')).toBeInTheDocument()
})

it('does not carry a recovery session across a change of identity', async () => {
  render(<AuthProvider><Probe /></AuthProvider>)
  await screen.findByText('authenticated:STUDENT:false')
  act(() => mocks.listener?.('PASSWORD_RECOVERY', session))
  await screen.findByText('authenticated:STUDENT:true')
  const other = { user: { id: 'other' } } as Session
  act(() => mocks.listener?.('SIGNED_IN', other))
  expect(await screen.findByText('authenticated:STUDENT:false')).toBeInTheDocument()
})
