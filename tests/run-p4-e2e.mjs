import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const ownedServers = []
const env = { ...process.env }
delete env.NO_COLOR

async function available(port) {
  try {
    return (await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) })).ok
  } catch { return false }
}

async function ensureServer(port, preview = false, serverEnv = env) {
  if (await available(port)) {
    if (process.env.CI) throw new Error(`Port ${port} must be free in CI.`)
    return
  }
  const child = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'),
    ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: 'inherit', env: serverEnv })
  ownedServers.push(child)
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server ${port} exited before startup.`)
    if (await available(port)) return
    await delay(200)
  }
  throw new Error(`Server ${port} did not start.`)
}

try {
  await access('dist/index.html')
  await ensureServer(5383)
  await ensureServer(4383, true)
  await ensureServer(5384, false, { ...env, VITE_SUPABASE_URL: 'https://pyr-e2e.example.test', VITE_SUPABASE_ANON_KEY: 'sb_publishable_e2e_fixture' })
  const runner = spawn(process.execPath, [resolve('node_modules/playwright/cli.js'), 'test', '--config', 'tests/p4.playwright.config.ts', ...process.argv.slice(2)],
    { stdio: 'inherit', env })
  const [code] = await once(runner, 'exit')
  process.exitCode = code ?? 1
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to run browser tests.')
  console.error('Run npm run build before npm run test:e2e.')
  process.exitCode = 1
} finally {
  for (const child of ownedServers) {
    if (child.exitCode !== null) continue
    const exited = once(child, 'exit')
    child.kill()
    await exited
  }
}
