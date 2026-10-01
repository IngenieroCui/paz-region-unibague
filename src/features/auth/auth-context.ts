import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Role } from '../../config/app'
export interface AuthState {
  status: 'unconfigured' | 'loading' | 'anonymous' | 'authenticated' | 'error'
  session: Session | null; roles: readonly Role[]; recovery?: boolean
}
export const AuthContext = createContext<AuthState>({ status: 'unconfigured', session: null, roles: [] })
export function useAuth() { return useContext(AuthContext) }
