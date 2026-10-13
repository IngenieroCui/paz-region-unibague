import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const env=process.env
const ready=Boolean(env.P7_PG_MODULE && env.P7_POSTGRES_URL && env.P7_ALLOW_DISPOSABLE_TESTS==='yes')
test('P7 flows A-H on real disposable Supabase with migrations 001-012', {skip:ready ? false : 'SKIPPED: P7 disposable Supabase URL/driver/explicit test opt-in unavailable.'},async () => {
  const driver=await import(env.P7_PG_MODULE), Client=driver.Client ?? driver.default.Client
  const db=new Client({connectionString:env.P7_POSTGRES_URL})
  try {
    await db.connect()
    const results=await db.query(await readFile(new URL('../../supabase/tests/p7_integration.test.sql',import.meta.url),'utf8'))
    const lines=(Array.isArray(results) ? results : [results]).flatMap(r => r.rows.flatMap(row => Object.values(row).filter(v => typeof v==='string')))
    assert.deepEqual(lines.filter(line => /^not ok\b|Looks like you failed/.test(line)),[])
    assert.ok(lines.filter(line => /^ok\b/.test(line)).length>=77)
  } finally {await db.query('rollback').catch(() => {});await db.end()}
})
