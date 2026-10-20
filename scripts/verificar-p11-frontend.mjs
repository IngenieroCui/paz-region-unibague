// Inspect resolved Vite exposure and built bytes without printing any value.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { resolveConfig } from 'vite'
import { environment } from './supabase-admin.mjs'
const values = await environment()
for (const command of ['serve','build']) {
  const config = await resolveConfig({}, command)
  assert.equal(config.env.VITE_SUPABASE_SECRET_KEY, undefined, 'Administrative variable must not be exposed')
  for (const name of Object.keys(config.env)) assert.ok(!/SECRET|SERVICE_ROLE|PASSWORD|ACCESS_TOKEN/.test(name), 'Private name in Vite environment')
}
let files = 0
async function scan(dir) {
  for (const item of await readdir(dir, {withFileTypes:true})) {
    const path = dir + '/' + item.name
    if (item.isDirectory()) await scan(path)
    else {
      const bytes = await readFile(path);files++
      for (const key of ['SUPABASE_SECRET_KEY','VITE_SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY']) if (values[key]) assert.ok(!bytes.includes(Buffer.from(values[key])), 'Private key in build')
      assert.ok(!/sb_secret_[A-Za-z0-9_-]{15,}/.test(bytes.toString()), 'Secret key in build')
    }
  }
}
await scan('dist')
console.log(JSON.stringify({vite_dev_exposure:'PASS',vite_build_exposure:'PASS',built_files_scanned:files,secret_findings:0}))
