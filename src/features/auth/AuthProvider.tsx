import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '../../lib/supabase/client'
import { supabaseConfiguration } from '../../lib/supabase/config'
import { currentRoles } from './services/auth'
import { AuthContext } from './auth-context'
import type { AuthState } from './auth-context'
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
    let unsubscribe = () => {}
    const timers = new Set<ReturnType<typeof setTimeout>>()
    function resolve(session: Session | null, isRecovery = false) {
      const request = ++version
      recovery = Boolean(session) && (isRecovery || (recovery && recoveryUser === session?.user.id))
      recoveryUser = session?.user.id ?? null
      if (!active) return
      if (!session) { setState({ status: 'anonymous', session: null, roles: [], recovery: false }); return }
      setState({ status: 'loading', session, roles: [], recovery })
      // Supabase calls listeners under its Auth lock; defer RPC until that lock is released.
      const timer = setTimeout(() => {
        timers.delete(timer)
        void currentRoles().then(roles => {
          if (active && request === version) setState({ status: 'authenticated', session, roles, recovery })
        }).catch(() => {
          if (active && request === version) setState({ status: 'error', session, roles: [], recovery })
        })
      }, 0)
      timers.add(timer)
    }
    async function initialize() {
      try {
        const client = await getSupabase()
        if (!active || !client) return
        const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
          receivedEvent = true
          resolve(session, event === 'PASSWORD_RECOVERY')
        })
        unsubscribe = () => subscription.unsubscribe()
        const { data, error } = await client.auth.getSession()
        if (error) throw error
        if (active && !receivedEvent) resolve(data.session)
      } catch {
        if (active) { ++version; setState({ status: 'error', session: null, roles: [], recovery: false }) }
      }
    }
    void initialize()
    return () => { active = false; ++version; unsubscribe(); timers.forEach(clearTimeout) }
  }, [])
  return <AuthContext value={state}>{children}</AuthContext>
}
