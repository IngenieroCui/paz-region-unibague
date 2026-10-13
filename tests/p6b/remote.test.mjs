import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
// Opt-in isolated Supabase test DB, already migrated. Never applies schema or seeds.
test('P6B pgTAP on an isolated real Supabase database', { skip: !process.env.P6B_DATABASE_URL ? 'SKIPPED: no P6B_DATABASE_URL configured; WASM is separate.' : false }, async () => {
  const { Client } = await import(process.env.P6B_PG_MODULE ?? 'pg')
  const db = new Client({ connectionString:process.env.P6B_DATABASE_URL })
  await db.connect()
  try {
    const results = await db.query(await readFile(new URL('./database.test.sql',import.meta.url),'utf8'))
    const rows = (Array.isArray(results) ? results : [results]).flatMap(result => result.rows)
    const failures = rows.flatMap(row => Object.values(row)).filter(value => typeof value === 'string' && /^(not ok|# Looks like)/.test(value))
    assert.deepEqual(failures,[])
  } finally { await db.query('rollback').catch(() => {}); await db.end() }
})
