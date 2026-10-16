import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { connect } from './p10-db.mjs'
import { save } from './p10-context.mjs'
const db=await connect(),report=[]
try {
 for(const path of ['supabase/tests/security.test.sql','supabase/tests/p3.test.sql','supabase/tests/p4.test.sql','supabase/tests/p5_matching.test.sql','supabase/tests/p6a_advisors.test.sql','tests/p6b/database.test.sql','supabase/tests/p6c_assignments.test.sql','supabase/tests/p7_integration.test.sql']) {
  try {
   // Supavisor RESET ROLE returns the ephemeral CLI login, not postgres.
   const sql=(await readFile(path,'utf8')).replace(/^\s*reset role\s*;?\s*$/gmi,'set role postgres;')
   const result=await db.query(sql)
   const lines=(Array.isArray(result)?result:[result]).flatMap(r=>r.rows.flatMap(row=>Object.values(row).filter(v=>typeof v==='string')))
   const failures=lines.filter(v=>/^not ok\b|^# Looks like/.test(v))
   const assertions=lines.filter(v=>/^ok\b/.test(v)).length
   report.push({path,assertions,failures});assert.deepEqual(failures,[]);assert.ok(assertions>0)
   console.log('PASS pgTAP hospedado',path,assertions)
  } finally {await db.query('rollback');await db.query('set role postgres')}
 }
}finally{await db.end();await save('sql-results.json',report)}
