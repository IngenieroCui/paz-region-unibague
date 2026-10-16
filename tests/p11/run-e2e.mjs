// Isolated HTTP fixtures: no Google credentials, mail or real signup requests.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
const port = 5861
const env = { ...process.env, VITE_SUPABASE_URL:'https://pyr-e2e.example.test', VITE_SUPABASE_ANON_KEY:'sb_publishable_e2e_fixture', VITE_EXTERNAL_REGISTRATION_ENABLED:'true', VITE_INSTITUTIONAL_GOOGLE_ENABLED:'false', VITE_TURNSTILE_SITE_KEY:'fixture', VITE_REGISTRATION_TERMS_URL:'https://institution.example.test/terms', VITE_REGISTRATION_PRIVACY_URL:'https://institution.example.test/privacy' }
delete env.NO_COLOR
const available = async () => { try { return (await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(500)})).ok } catch { return false } }
if (await available()) throw new Error('P11 port must be free; refusing to reuse a server.')
const server = spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{env,stdio:'inherit',windowsHide:true})
try {
  for(let attempt=0;!await available();attempt++){ if(server.exitCode!==null||attempt>=100)throw new Error('P11 Vite startup failed');await delay(200) }
  const runner=spawn(process.execPath,[resolve('node_modules/playwright/cli.js'),'test','--config','tests/p11/playwright.config.ts',...process.argv.slice(2)],{env,stdio:'inherit',windowsHide:true})
  const [code]=await once(runner,'exit');process.exitCode=code??1
} finally { if(server.exitCode===null){const closed=once(server,'exit');server.kill();await closed} }
