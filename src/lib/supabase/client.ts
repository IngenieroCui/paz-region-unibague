import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { supabaseConfiguration } from './config'
let clientPromise: Promise<SupabaseClient<Database>> | undefined
export async function getSupabase(): Promise<SupabaseClient<Database> | null> {
  if (supabaseConfiguration.status !== 'ready') return null
  const { url, key } = supabaseConfiguration
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => createClient<Database>(url, key, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
  }))
  return clientPromise
}
