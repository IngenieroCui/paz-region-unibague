import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './auth-context'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), rpc: vi.fn(), listener: undefined as undefined | ((event: string, session: Session | null) => void) }))
vi.mock('../../lib/supabase/config', () => ({ supabaseConfiguration: { status: 'ready' } }))
vi.mock('../../lib/supabase/client', () => ({ getSupabase: async () => ({ rpc: mocks.rpc, auth: {
  getSession: mocks.getSession,
  onAuthStateChange: (listener: typeof mocks.listener) => { mocks.listener = listener; return { data: { subscription: { unsubscribe() {} } } } },
} }) }))
function Probe() { const auth = useAuth(); return <output>{auth.status}:{auth.roles.join(',')}</output> }
afterEach(() => vi.useRealTimers())

it('exits loading when session initialization never settles', async () => {
  vi.useFakeTimers()
  mocks.getSession.mockImplementation(() => new Promise(() => {}))
  render(<AuthProvider><Probe /></AuthProvider>)
  await act(async () => { await vi.advanceTimersByTimeAsync(20_001) })
  expect(screen.getByText('error:')).toBeInTheDocument()
})

it('fails closed when a role lookup hangs and ignores its eventual response', async () => {
  vi.useFakeTimers()
  const session = { user: { id: 'deadline-user' }, access_token: 'deadline-token' } as Session
  let finish: (value: { data: string[]; error: null }) => void = () => {}
  mocks.getSession.mockResolvedValue({ data: { session }, error: null })
  mocks.rpc.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<AuthProvider><Probe /></AuthProvider>)
  await act(async () => { await vi.advanceTimersByTimeAsync(20_001) })
  expect(screen.getByText('error:')).toBeInTheDocument()
  await act(async () => finish({ data: ['ADMIN'], error: null }))
  expect(screen.getByText('error:')).toBeInTheDocument()
  mocks.rpc.mockResolvedValue({ data: ['STUDENT'], error: null })
  await act(async () => { mocks.listener?.('SIGNED_IN', session); await vi.advanceTimersByTimeAsync(1) })
  expect(screen.getByText('authenticated:STUDENT')).toBeInTheDocument()
})
