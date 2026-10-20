import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writer, validateLedger, ref } from '../../scripts/p12-context.mjs'

function database(initial = []) {
  const stored = structuredClone(initial)
  let fail = false
  const client = { from() {
    let filter = {}, insertion
    const query = {
      select() { return this }, match(value) { filter = value; return this }, order() { return this },
      range() { return Promise.resolve({ data: stored.filter(row => Object.entries(filter).every(([k,v]) => row[k] === v)), error: null }) },
      insert(value) { insertion = value; return this },
      single() {
        if (fail) { fail = false; return Promise.resolve({ error: { code: 'UNCERTAIN' } }) }
        stored.push(insertion); return Promise.resolve({ data: insertion, error: null })
      },
    }
    return query
  } }
  return { client, stored, failOnce() { fail = true } }
}
test('rerun reuses the same UUID and never inserts a duplicate', async () => {
  const db = database(), m = { records: {} }, w = writer(m, async () => {})
  const first = await w.ensure(db.client, 'Students', 's1', { user_id: 'test-user' })
  const second = await w.ensure(db.client, 'Students', 's1', { user_id: 'test-user' })
  assert.equal(first.id, second.id); assert.equal(db.stored.length, 1); assert.equal(m.records.s1.created, true)
})
test('intent persists before an uncertain write and retry uses the recorded UUID', async () => {
  const db = database(), m = { records: {} }, snapshots = [], w = writer(m, async () => snapshots.push(structuredClone(m)))
  db.failOnce()
  await assert.rejects(w.ensure(db.client, 'Students', 's1', { user_id: 'test-user' }), /UNCERTAIN/)
  const intended = snapshots[0].records.s1.id
  assert.equal((await w.ensure(db.client, 'Students', 's1', { user_id: 'test-user' })).id, intended)
})
test('preexisting rows are recorded as reused and ambiguous rows abort', async () => {
  const db = database([{ id: 'old', code: 'TEST' }]), m = { records: {} }, w = writer(m, async () => {})
  await w.ensure(db.client, 'Skills', 'skill', { code: 'TEST' })
  assert.equal(m.records.skill.created, false)
  db.stored.push({ id: 'other', code: 'TEST' })
  await assert.rejects(w.ensure(db.client, 'Skills', 'skill', { code: 'TEST' }), /ambigua/)
})
test('a removed reused row is never recreated and changed identities abort', async () => {
  const db = database(), m = { records: { s: { id: 'old', created: false } } }, w = writer(m, async () => {})
  await assert.rejects(w.ensure(db.client, 'Students', 's', { user_id: 'test-user' }), /desapareció/)
  db.stored.push({ id: 'replacement', user_id: 'test-user' })
  await assert.rejects(w.ensure(db.client, 'Students', 's', { user_id: 'test-user' }), /Identidad modificada/)
  assert.equal(db.stored.length, 1)
})
test('account registry rejects wrong projects before credentials or network calls', () => {
  assert.throws(() => validateLedger({ project_ref: 'wrong', accounts: [] }), /otro proyecto/)
  assert.throws(() => validateLedger({ project_ref: ref, accounts: [] }))
})
