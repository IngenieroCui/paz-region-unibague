import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import type { Database } from '../../../src/lib/supabase/database.types.ts'
import { createMatchingHandler } from './handler.ts'
Deno.serve(createMatchingHandler({
  env: key => Deno.env.get(key),
  client: authorization => createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
  }),
}))
