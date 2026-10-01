// Test-only entrypoint, never imported by the application/router/build.
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import MatchingWorkspace from '../../src/features/matching/MatchingWorkspace.tsx'
import { getSupabase } from '../../src/lib/supabase/client.ts'
import '../../src/styles/tokens.css'
import '../../src/styles/global.css'
import '../../src/styles/components.css'
import '../../src/styles/modules.css'
import '../../src/styles/workspace.css'
if (import.meta.env.DEV && location.hostname === '127.0.0.1') {
  const db = await getSupabase()
  await db?.auth.signInWithPassword({ email: 'p5-test@example.test', password: 'isolated-http-fixture' })
  const element = document.getElementById('root')
  if (element) createRoot(element).render(createElement(MatchingWorkspace))
}
