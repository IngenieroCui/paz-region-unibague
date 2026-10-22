import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
const env=process.env
const ready=env.P11_1_POSTGRES_URL && env.P11_1_PG_MODULE && env.P11_1_ALLOW_DISPOSABLE_TESTS==='yes'
test('P11.1 unique normalized identities survive concurrent repeatable-read snapshots',{skip:ready?false:'Requires authorized disposable PostgreSQL, pg driver and explicit opt-in'},async()=>{
 const driver=await import(env.P11_1_PG_MODULE),Client=driver.Client??driver.default.Client
 const a=new Client({connectionString:env.P11_1_POSTGRES_URL}),b=new Client({connectionString:env.P11_1_POSTGRES_URL})
 const id=randomUUID(),other=randomUUID(),name='TEST P11.1 concurrency '+randomUUID()
 try{
  await a.connect();await b.connect()
  await a.query('begin isolation level repeatable read');await b.query('begin isolation level repeatable read')
  await b.query('select count(*) from public."PYRUnibague_Organizations"')
  await a.query('insert into public."PYRUnibague_Organizations"(id,legal_name,status) values($1,$2,$3)',[id,name,'pending_review'])
  await b.query("set local statement_timeout='10s'")
  const competing=b.query('insert into public."PYRUnibague_Organizations"(id,legal_name,status) values($1,$2,$3)',[other,' '+name.toLowerCase()+' ','pending_review']).then(()=>null,error=>error.code)
  await a.query('commit')
  assert.equal(await competing,'23505')
 }finally{
  await b.query('rollback').catch(()=>{});await a.query('rollback').catch(()=>{})
  await a.query('delete from public."PYRUnibague_Organizations" where id=any($1::uuid[])',[[id,other]]).catch(()=>{})
  await Promise.all([a.end(),b.end()])
 }
})
