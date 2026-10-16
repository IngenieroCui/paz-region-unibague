// Supplemental PostgreSQL execution, never a substitute for Supabase/Auth or real concurrency.
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const modulePath = process.env.P6C_PGLITE_MODULE
if (!modulePath) { console.log('SKIPPED: set P6C_PGLITE_MODULE to an externally installed PGlite module.'); process.exit(0) }
const { PGlite } = await import(modulePath)
const db = new PGlite()
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create role supabase_admin;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage,extensions to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security; grant all on storage.objects to authenticated;
    create function extensions.no_plan() returns text language sql as $$select 'Supplemental SQL assertions'$$;
    create function extensions.ok(value boolean,label text) returns text language plpgsql as $$begin if value is distinct from true then raise exception 'Assertion failed: %',label; end if; return label; end$$;
    create function extensions.lives_ok(statement text,label text) returns text language plpgsql as $$begin execute statement; return label; end$$;
    create function extensions.throws_ok(statement text,expected text,message text,label text) returns text language plpgsql as $$declare caught text; begin begin execute statement; exception when others then get stacked diagnostics caught=returned_sqlstate; end; if caught is distinct from expected then raise exception 'Expected %, got %: %',expected,caught,label; end if; return label; end$$;
    create function extensions.finish() returns setof text language sql as $$select 'Assertions complete'$$;
    grant execute on all functions in schema extensions to authenticated,anon;`)
  for (const file of (await readdir(resolve('supabase/migrations'))).filter(n => n.endsWith('.sql')).sort()) {
    try { await db.exec(await readFile(resolve('supabase/migrations', file), 'utf8')); console.log('Applied:', file) }
    catch (error) { console.error(error.message); throw error }
  }
  const sql = (await readFile(resolve('supabase/tests/p6c_assignments.test.sql'), 'utf8')).replace('create extension if not exists pgtap with schema extensions;', '')
  const results = await db.exec(sql)
  const assertions = results.flatMap(r => r.rows).filter(r => 'ok' in r || 'throws_ok' in r || 'lives_ok' in r)
  for (const row of assertions) console.log('PASS:', Object.values(row)[0])
  console.log(`PASS: ${assertions.length} P6C supplemental SQL assertions. Single-session WASM, Auth/Storage stubs.`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { await db.close() }
