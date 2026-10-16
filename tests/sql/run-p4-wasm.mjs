const { PGlite } = await import(process.env.PYR_PGLITE_MODULE ?? '@electric-sql/pglite')
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
for (const file of (await readdir(root+'/supabase/migrations')).filter(file => /(?:20261001000[1-6]_|_p8_00[1-6]_)/.test(file)).sort()) {
  console.log('Applying', file)
  try { await db.exec(await readFile(root+'/supabase/migrations/'+file,'utf8')) }
  catch(error) { console.error(error.message); console.error(error.query); throw error }
}
await db.exec(await readFile(root+'/supabase/seed.sql','utf8'))
const types = (await readFile(root+'/src/lib/supabase/database.generated.ts','utf8')).replaceAll('\r\n','\n')
const columns = await db.query("select table_name, column_name, udt_name, is_nullable from information_schema.columns where table_schema='public' and table_name like 'PYRUnibague_%'")
for (const column of columns.rows) {
  const body = types.split(column.table_name+': {')[1]?.split('Row: {')[1]?.split('    }')[0]
  const tsType = column.udt_name==='jsonb' ? 'Json' : column.udt_name==='_text' ? 'string[]' : column.udt_name==='bool' ? 'boolean' : ['int4','int8','numeric'].includes(column.udt_name) ? 'number' : 'string'
  const expected = `      ${column.column_name}: ${tsType}${column.is_nullable==='YES' ? ' | null' : ''}`
  if (!body?.split('\n').some(line => line.trim() === expected.trim())) throw new Error('Type fallback mismatch: '+column.table_name+'.'+column.column_name)
}
const fks = await db.query("select conname from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and conname like 'pyr_fk_%'")
for (const fk of fks.rows) if (!types.includes(`foreignKeyName: "${fk.conname}"`)) throw new Error('FK type mismatch: '+fk.conname)
console.log('Fallback type/catalog verification:', columns.rows.length, 'columns and', fks.rows.length, 'public FKs')
const test = (await readFile(root+'/supabase/tests/security.test.sql','utf8')).replace('create extension if not exists pgtap with schema extensions;', '')
try {
  const result = await db.exec(test)
  const lines = result.flatMap(r=>r.rows.flatMap(row=>Object.values(row).filter(v=>typeof v==='string' && v.startsWith('ok:'))))
  console.log(lines.join('\n'))
  console.log('PostgreSQL WASM smoke assertions:', lines.length, '(Supabase runtime remains unverified)')
} catch(error) { console.error(error.message); console.error('position:', error.position); await db.exec('rollback'); throw error }
for (const name of ['p3.test.sql','p4.test.sql']) { const sql = (await readFile(root+'/supabase/tests/'+name,'utf8')).replace('create extension if not exists pgtap with schema extensions;', ''); const result = await db.exec(sql); const lines = result.flatMap(r=>r.rows.flatMap(row=>Object.values(row).filter(v=>typeof v==='string' && v.startsWith('ok:')))); console.log(lines.join('\n')); console.log(name+' WASM assertions:', lines.length) }
await db.close()
