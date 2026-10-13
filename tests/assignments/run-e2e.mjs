// Direct child processes avoid shell process-tree teardown restrictions on Windows.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
const root = fileURLToPath(new URL('../../', import.meta.url))
const env = { ...process.env, VITE_SUPABASE_URL: 'https://pyr-e2e.example.test', VITE_SUPABASE_ANON_KEY: 'sb_publishable_e2e_fixture' }
delete env.NO_COLOR
let server
async function available() { try { return (await fetch('http://127.0.0.1:5416', { signal: AbortSignal.timeout(500) })).ok } catch { return false } }
try {
  if (await available()) throw new Error('P6C test port 5416 must be free; no unrelated server is reused.')
  server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5416', '--strictPort'], { cwd: root, stdio: 'inherit', env, windowsHide: true })
  let started = false
  for (let i = 0; i < 100; i++) { if (server.exitCode !== null) throw new Error('P6C Vite exited before startup'); if (await available()) { started = true; break }; await delay(200) }
  if (!started) throw new Error('P6C Vite did not start')
  const runner = spawn(process.execPath, [resolve(root, 'node_modules/playwright/cli.js'), 'test', '--config', 'tests/assignments/playwright.config.ts', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', env, windowsHide: true })
  const [code] = await once(runner, 'exit'); process.exitCode = code ?? 1
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { if (server && server.exitCode === null) { const done = once(server, 'exit'); server.kill(); await done } }
