import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
const env = { ...process.env,VITE_SUPABASE_URL:'https://pyr-e2e.example.test',VITE_SUPABASE_ANON_KEY:'sb_publishable_e2e_fixture' }
delete env.NO_COLOR
const port = 5396
async function available() { try { return (await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(500)})).ok } catch { return false } }
if (await available()) throw new Error('P6B port 5396 must be free; refusing to reuse an unknown server.')
const server = spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{env,stdio:'inherit',windowsHide:true})
try {
  for (let attempt=0; ; attempt++) {
    if (server.exitCode !== null || attempt >= 100) throw new Error('P6B Vite startup failed.')
    if (await available()) break
    await delay(200)
  }
  const runner = spawn(process.execPath,[resolve('node_modules/playwright/cli.js'),'test','--config','tests/p6b/playwright.config.ts',...process.argv.slice(2)],{env,stdio:'inherit',windowsHide:true})
  const [code] = await once(runner,'exit'); process.exitCode = code ?? 1
} finally {
  if (server.exitCode === null) { const closed = once(server,'exit'); server.kill(); await closed }
}
