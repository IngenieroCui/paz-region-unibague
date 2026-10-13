// Real Supabase SQL/RLS and two-session locking. Requires a DISPOSABLE test database.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
const env=process.env
const ready=Boolean(env.P6A_PG_MODULE&&env.P6A_POSTGRES_URL)
async function connect() {
 const module=await import(env.P6A_PG_MODULE)
 const Client=module.Client??module.default.Client
 const db=new Client({connectionString:env.P6A_POSTGRES_URL})
 await db.connect();return db
}
test('real Supabase executes P6A pgTAP fixtures under actual RLS', {skip:ready?false:'SKIPPED: disposable Supabase Postgres URL/driver unavailable.'},async()=>{
 const db=await connect()
 try {
  const schema=await db.query("select to_regclass('auth.users') as users,to_regclass('storage.objects') as objects")
  assert.ok(schema.rows[0].users&&schema.rows[0].objects,'Requires actual Supabase Auth and Storage schemas')
  const results=await db.query(await readFile('supabase/tests/p6a_advisors.test.sql','utf8'))
  const rows=(Array.isArray(results)?results:[results]).flatMap(r=>r.rows)
  const tap=rows.flatMap(row=>Object.values(row)).filter(value=>typeof value==='string'&&/^(?:not )?ok \d+/.test(value))
  assert.ok(tap.length>=85,'All P6A assertions must execute')
  assert.deepEqual(tap.filter(value=>value.startsWith('not ok')),[])
 }finally {await db.query('rollback').catch(()=>{});await db.end()}
})
const fixtureReady=ready&&['P6A_ADMIN_USER_ID','P6A_ORGANIZATION_ID','P6A_PERIOD_ID','P6A_ADVISOR_A_ID','P6A_ADVISOR_B_ID'].every(key=>env[key])
test('two real sessions serialize organization-advisor changes and retain both histories', {skip:fixtureReady?false:'SKIPPED: isolated Supabase concurrency fixture/driver unavailable.'},async()=>{
 assert.notEqual(env.P6A_ADVISOR_A_ID,env.P6A_ADVISOR_B_ID)
 const a=await connect(),b=await connect()
 try {
  for(const db of [a,b]) {
   await db.query('begin');await db.query('set local role authenticated')
   await db.query("select set_config('request.jwt.claim.sub',$1,true)",[env.P6A_ADMIN_USER_ID])
   await db.query("set local statement_timeout='8s'")
  }
  const pidA=(await a.query('select pg_backend_pid() as pid')).rows[0].pid
  const pidB=(await b.query('select pg_backend_pid() as pid')).rows[0].pid
  const sql='select public.pyr_unibague_change_organization_advisor($1,$2,$3) as id'
  const before=(await a.query('select count(*)::int as count from public."PYRUnibague_AdvisorOrganizationAssignments" where organization_id=$1 and academic_period_id=$2',[env.P6A_ORGANIZATION_ID,env.P6A_PERIOD_ID])).rows[0].count
  await a.query(sql,[env.P6A_ORGANIZATION_ID,env.P6A_PERIOD_ID,env.P6A_ADVISOR_A_ID])
  const pending=b.query(sql,[env.P6A_ORGANIZATION_ID,env.P6A_PERIOD_ID,env.P6A_ADVISOR_B_ID]).then(result=>({result}),error=>({error}))
  let locked=false
  for(let attempt=0;attempt<50;attempt++) {
   const result=await a.query('select pg_blocking_pids($1) as blockers',[pidB])
   if(result.rows[0].blockers.includes(pidA)){locked=true;break}
   await delay(50)
  }
  assert.equal(locked,true,'Second change must block behind the first transaction')
  await a.query('commit')
  const outcome=await pending
  assert.ok(!outcome.error,'Second RPC must complete after the first commit')
  await b.query('commit')
  await a.query('begin');await a.query('set local role authenticated');await a.query("select set_config('request.jwt.claim.sub',$1,true)",[env.P6A_ADMIN_USER_ID])
  const rows=(await a.query('select advisor_id,is_current from public."PYRUnibague_AdvisorOrganizationAssignments" where organization_id=$1 and academic_period_id=$2',[env.P6A_ORGANIZATION_ID,env.P6A_PERIOD_ID])).rows
  assert.equal(rows.filter(row=>row.is_current).length,1)
  assert.equal(rows.find(row=>row.is_current).advisor_id,env.P6A_ADVISOR_B_ID)
  assert.ok(rows.length>=before+1,'Concurrent replacements retain history')
 }finally {await Promise.allSettled([a.query('rollback'),b.query('rollback')]);await Promise.allSettled([a.end(),b.end()])}
})
