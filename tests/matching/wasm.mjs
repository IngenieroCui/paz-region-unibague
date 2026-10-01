// Supplemental SQL execution, not Supabase Auth/HTTP or multi-session certification.
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const modulePath = process.env.P5_PGLITE_MODULE
if (!modulePath) { console.log('SKIPPED: PostgreSQL WASM module not configured (P5_PGLITE_MODULE).'); process.exit(0) }
const { PGlite } = await import(modulePath)
const db = new PGlite()
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create role supabase_admin;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage,extensions to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant all on storage.objects to authenticated;
    create function extensions.no_plan() returns text language sql as $$select 'WASM assertions (pgTAP-compatible shim)'$$;
    create function extensions.ok(value boolean,label text) returns text language plpgsql as $$begin if value is distinct from true then raise exception 'Assertion failed: %',label; end if; return label; end$$;
    create function extensions.lives_ok(statement text,label text) returns text language plpgsql as $$begin execute statement; return label; end$$;
    create function extensions.throws_ok(statement text,expected text,message text,label text) returns text language plpgsql as $$declare caught text; begin begin execute statement; exception when others then get stacked diagnostics caught=returned_sqlstate; end; if caught is distinct from expected then raise exception 'Expected %, got %: %',expected,caught,label; end if; return label; end$$;
    create function extensions.finish() returns setof text language sql as $$select 'WASM assertions complete'$$;
    grant execute on all functions in schema extensions to authenticated,anon;`)
  for (const file of (await readdir(resolve('supabase/migrations'))).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(resolve('supabase/migrations', file), 'utf8')); console.log('Applied:', file)
  }
  const sql = (await readFile(resolve('supabase/tests/p5_matching.test.sql'), 'utf8')).replace('create extension if not exists pgtap with schema extensions;', '')
  const results = await db.exec(sql)
  let assertions = 0
  for (const result of results) for (const row of result.rows) if ('ok' in row || 'throws_ok' in row || 'lives_ok' in row) assertions++
  console.log(`PASS: ${assertions} P5 SQL assertions using WASM. Single database, auth/storage stubs.`)
} finally { await db.close() }
