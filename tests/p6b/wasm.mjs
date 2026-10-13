const modulePath = process.env.P6B_PGLITE_MODULE
if (!modulePath) { console.log('SKIPPED: supplemental WASM module unavailable.'); process.exit(0) }
const { PGlite } = await import(modulePath)
import { readFile, readdir } from 'node:fs/promises'
const root = process.cwd()
process.on('uncaughtException', error => { console.error(error.message); process.exit(1) })
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage; create schema extensions;
grant usage on schema auth, storage, extensions to anon, authenticated;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, unique(bucket_id,name));
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated;
create function extensions.no_plan() returns text language sql as $$ select 'WASM smoke; not pgTAP runtime'::text $$;
create function extensions.is(actual integer, expected integer, message text) returns text language plpgsql as $$ begin if actual is distinct from expected then raise exception 'FAIL: % (actual %, expected %)',message,actual,expected; end if; return 'ok: '||message; end $$;
create function extensions.is(actual text, expected text, message text) returns text language plpgsql as $$ begin if actual is distinct from expected then raise exception 'FAIL: % (actual %, expected %)',message,actual,expected; end if; return 'ok: '||message; end $$;
create function extensions.ok(actual boolean, message text) returns text language plpgsql as $$ begin if actual is distinct from true then raise exception 'FAIL: %',message; end if; return 'ok: '||message; end $$;
create function extensions.finish() returns setof text language sql as $$ select 'WASM smoke completed'::text $$;
create function extensions.lives_ok(statement text, message text) returns text language plpgsql as $$ begin execute statement; return 'ok: '||message; end $$;
create function extensions.throws_ok(statement text, expected text, errmsg text, message text) returns text language plpgsql as $$
declare caught text;
begin
 begin execute statement; exception when others then get stacked diagnostics caught = returned_sqlstate; end;
 if caught is distinct from expected then raise exception 'FAIL: % (actual %, expected %)',message,caught,expected; end if;
 return 'ok: '||message;
end $$;
`)

try {
 for (const file of (await readdir(root+'/supabase/migrations')).filter(file => /20261001000[1-7]_/.test(file) || file === '202610010009_calls_projects_groups_p6b.sql').sort()) {
  await db.exec(await readFile(root+'/supabase/migrations/'+file,'utf8')); console.log('Applied:',file)
 }
 await db.exec(await readFile(root+'/supabase/seed.sql','utf8'))
 const sql=(await readFile(root+'/tests/p6b/database.test.sql','utf8')).replace('create extension if not exists pgtap with schema extensions;','')
 const results=await db.exec(sql)
 const lines=results.flatMap(result=>result.rows.flatMap(row=>Object.values(row).filter(value=>typeof value==='string' && value.startsWith('ok:'))))
 console.log(lines.join('\n')); console.log('PASS:',lines.length,'P6B supplemental WASM assertions. Supabase runtime and multi-session concurrency: SKIPPED.')
} catch(error) { console.error(error.message); console.error(error.query); process.exitCode=1 }
finally { await db.close() }
