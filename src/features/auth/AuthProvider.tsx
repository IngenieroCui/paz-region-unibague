import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '../../lib/supabase/client'
import { supabaseConfiguration } from '../../lib/supabase/config'
import { currentRoles } from './services/auth'
import { AuthContext } from './auth-context'
import type { AuthState } from './auth-context'
import { clearCatalogCache } from '../../lib/supabase/catalog-cache'
import { withDeadline } from '../../lib/supabase/deadline'
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: supabaseConfiguration.status === 'ready' ? 'loading' : 'unconfigured', session: null, roles: [], recovery: false,
  })
  useEffect(() => {
    let active = true
    let version = 0
    let receivedEvent = false
    let recovery = false
    let recoveryUser: string | null = null
    let lastUser: string | undefined
    let lastToken: string | undefined
    let lastVerificationStarted = 0
    let unsubscribe = () => {}
    const timers = new Set<ReturnType<typeof setTimeout>>()
    function resolve(session: Session | null, isRecovery = false, event?: string) {
      // Supabase can re-emit SIGNED_IN on tab focus for the very same token.
      // TOKEN_REFRESHED and USER_UPDATED still verify persisted roles every time.
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.access_token && lastToken === session.access_token && lastUser === session.user.id && Date.now()-lastVerificationStarted < 30_000) return
      if (lastUser !== session?.user.id || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') clearCatalogCache()
      lastUser = session?.user.id
      lastToken = session?.access_token
      lastVerificationStarted = Date.now()
      const request = ++version
      recovery = Boolean(session) && (isRecovery || (recovery && recoveryUser === session?.user.id))
      recoveryUser = session?.user.id ?? null
      if (!active) return
      if (!session) { setState({ status: 'anonymous', session: null, roles: [], recovery: false }); return }
      setState(previous => previous.status === 'authenticated' && previous.session?.user.id === session.user.id
        ? { ...previous, session, recovery }
        : { status: 'loading', session, roles: [], recovery })
      // Supabase calls listeners under its Auth lock; defer RPC until that lock is released.
      const timer = setTimeout(() => {
        timers.delete(timer)
        void withDeadline(currentRoles(), 15_000).then(roles => {
          if (active && request === version) setState({ status: 'authenticated', session, roles, recovery })
        }).catch(() => {
          if (active && request === version) { lastToken = undefined; setState({ status: 'error', session, roles: [], recovery }) }
        })
      }, 0)
      timers.add(timer)
    }
    async function initialize() {
      try {
        const client = await withDeadline(getSupabase(), 15_000)
        if (!active) return
        if (!client) throw new Error('Auth unavailable')
        const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
          receivedEvent = true
          resolve(session, event === 'PASSWORD_RECOVERY', event)
        })
        unsubscribe = () => subscription.unsubscribe()
        const { data, error } = await withDeadline(client.auth.getSession(), 15_000)
        if (error) throw error
        if (active && !receivedEvent) resolve(data.session)
      } catch {
        // Auth events are newer than the initial read, including a failed initial read.
        if (active && !receivedEvent) { ++version; setState({ status: 'error', session: null, roles: [], recovery: false }) }
      }
    }
    void initialize()
    return () => { active = false; ++version; unsubscribe(); timers.forEach(clearTimeout) }
  }, [])
  return <AuthContext value={state}>{children}</AuthContext>
}
