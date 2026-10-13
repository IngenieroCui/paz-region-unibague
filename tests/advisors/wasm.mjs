// Supplemental syntax/constraints/RLS smoke with Auth/Storage stubs, never real Supabase certification.
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const modulePath=process.env.P6A_PGLITE_MODULE
if(!modulePath){console.log('SKIPPED: P6A_PGLITE_MODULE not configured.');process.exit(0)}
const {PGlite}=await import(modulePath)
const db=new PGlite()
try {
 await db.exec(`create role anon; create role authenticated; create role service_role; create role supabase_admin;
 create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,extensions to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security; grant all on storage.objects to authenticated;
 create function extensions.no_plan() returns text language sql as $$select 'Supplemental WASM smoke'$$;
 create function extensions.ok(v boolean,label text) returns text language plpgsql as $$begin if v is distinct from true then raise exception 'FAIL: %',label;end if;return label;end$$;
 create function extensions.lives_ok(statement text,label text) returns text language plpgsql as $$begin execute statement;return label;end$$;
 create function extensions.throws_ok(statement text,expected text,message text,label text) returns text language plpgsql as $$declare caught text;begin begin execute statement;exception when others then get stacked diagnostics caught=returned_sqlstate;end;if caught is distinct from expected then raise exception 'FAIL: % expected %, got %',label,expected,caught;end if;return label;end$$;
 create function extensions.finish() returns setof text language sql as $$select 'Smoke complete'$$;
 grant execute on all functions in schema extensions to anon,authenticated;`)
 for(const file of (await readdir(resolve('supabase/migrations'))).filter(name=>name.endsWith('.sql')).sort()) {
  await db.exec(await readFile(resolve('supabase/migrations',file),'utf8'));console.log('Applied:',file)
 }
 const types=await readFile(resolve('src/lib/supabase/database.types.ts'),'utf8')
 const columns=await db.query("select table_name,column_name,udt_name,is_nullable from information_schema.columns where table_schema='public' and table_name like 'PYRUnibague_%'")
 for(const col of columns.rows) {
  const body=types.split(col.table_name+': {')[1]?.split('Row: {')[1]?.split('    }')[0]
  const t=col.udt_name==='jsonb'?'Json':col.udt_name==='_text'?'string[]':col.udt_name==='bool'?'boolean':['int4','int8','numeric'].includes(col.udt_name)?'number':'string'
  if(!body?.replaceAll('\r','').split('\n').includes(`      ${col.column_name}: ${t}${col.is_nullable==='YES'?' | null':''}`))throw new Error('Fallback column mismatch: '+col.table_name+'.'+col.column_name)
 }
 const fks=await db.query("select conname from pg_constraint where conname like 'pyr_p6a_%'")
 for(const fk of fks.rows)if(!types.includes(`foreignKeyName: "${fk.conname}"`)&&!fk.conname.endsWith('_user_id')&&!fk.conname.endsWith('_assigned_by')&&!fk.conname.endsWith('_reviewed_by'))throw new Error('Fallback relationship mismatch: '+fk.conname)
 console.log('Fallback verified:',columns.rows.length,'columns;',fks.rows.length,'P6A foreign keys')
 for(const name of ['p6a_advisors.test.sql','p5_matching.test.sql']) {
  const sql=(await readFile(resolve('supabase/tests',name),'utf8')).replace('create extension if not exists pgtap with schema extensions;','')
  const results=await db.exec(sql)
  const assertions=results.flatMap(r=>r.rows).filter(r=>'ok'in r||'throws_ok'in r||'lives_ok'in r)
  console.log('PASS:',assertions.length,name,'supplemental assertions (not real Supabase)')
 }
}catch(error){console.error(error.message);if(error.where)console.error(error.where);process.exitCode=1}
finally {await db.close()}
