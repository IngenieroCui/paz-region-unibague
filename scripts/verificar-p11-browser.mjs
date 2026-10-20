// Starts an owned local server; real Auth/Data API, no HTTP fixtures or traces.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { environment } from './supabase-admin.mjs'
const env = await environment()
const port = 5871
const base = `http://127.0.0.1:${port}`
async function available() { try { return (await fetch(base,{signal:AbortSignal.timeout(500)})).ok } catch { return false } }
if (await available()) throw Error('Puerto ocupado; no se reutiliza un servidor ajeno.')
// The public flags stay closed even if local files are accidentally changed.
const child = spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{windowsHide:true,stdio:'inherit',env:{...process.env,VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY:env.VITE_SUPABASE_ANON_KEY,VITE_EXTERNAL_REGISTRATION_ENABLED:'false',VITE_INSTITUTIONAL_GOOGLE_ENABLED:'false'}})
try {
  for(let i=0;!await available();i++) { if(child.exitCode!==null||i>100)throw Error('No inició Vite');await delay(200) }
  const runner=spawn(process.execPath,[resolve(process.argv.includes('--journey')?'scripts/verificar-p11-recorrido.mjs':'scripts/verify-p9-pilot.mjs')],{windowsHide:true,stdio:'inherit',env:{...process.env,PYR_TEST_BASE_URL:base}})
  const [code]=await once(runner,'exit');process.exitCode=code??1
} finally { if(child.exitCode===null){const closed=once(child,'exit');child.kill();await closed} }
