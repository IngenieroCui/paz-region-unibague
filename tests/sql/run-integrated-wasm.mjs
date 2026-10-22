// Supplemental single-session PostgreSQL WASM; Auth/Storage are stubs.
// Never reports real Supabase, pgTAP extension or multi-connection certification.
import { readFile, readdir } from 'node:fs/promises'
const modulePath = process.env.PYR_PGLITE_MODULE
if (!modulePath) { console.log('SKIPPED: PYR_PGLITE_MODULE unavailable'); process.exit(0) }
const { PGlite } = await import(modulePath)
const db = new PGlite()
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_admin; create role supabase_auth_admin;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
    create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,provider_id text,identity_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage,extensions to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security; grant all on storage.objects to authenticated,anon;
    create function extensions.no_plan() returns text language sql as $$select 'Supplemental WASM assertions'$$;
    create function extensions.ok(v boolean,label text) returns text language plpgsql as $$begin if v is distinct from true then raise exception 'FAIL: %',label;end if;return label;end$$;
    create function extensions.is(actual integer,expected integer,label text) returns text language plpgsql as $$begin if actual is distinct from expected then raise exception 'FAIL: % (actual %, expected %)',label,actual,expected;end if;return label;end$$;
    create function extensions.is(actual text,expected text,label text) returns text language plpgsql as $$begin if actual is distinct from expected then raise exception 'FAIL: % (actual %, expected %)',label,actual,expected;end if;return label;end$$;
    create function extensions.lives_ok(statement text,label text) returns text language plpgsql as $$begin execute statement;return label;end$$;
    create function extensions.throws_ok(statement text,expected text,message text,label text) returns text language plpgsql as $$declare caught text;begin begin execute statement;exception when others then get stacked diagnostics caught=returned_sqlstate;end;if caught is distinct from expected then raise exception 'FAIL: % expected %, got %',label,expected,caught;end if;return label;end$$;
    create function extensions.finish() returns setof text language sql as $$select 'Smoke complete'$$;
    grant execute on all functions in schema extensions to anon,authenticated;`)
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(await readFile('supabase/migrations/' + file, 'utf8')); console.log('Applied:', file)
  }
  const { rows: columns } = await db.query("select table_name,column_name,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' and starts_with(table_name,'PYRUnibague_') order by table_name,ordinal_position")
  const tables = [...new Set(columns.map(c => c.table_name))]
  if (tables.length !== 45) throw new Error(`Expected 45 tables, got ${tables.length}`)
  const { rows: fks } = await db.query(`select c.conname,t.relname as table_name,rt.relname as referenced_table,
    array(select a.attname from unnest(c.conkey) with ordinality k(n,i) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.n order by k.i) as columns,
    array(select a.attname from unnest(c.confkey) with ordinality k(n,i) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.n order by k.i) as referenced_columns,
    exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indisunique and i.indpred is null and i.indkey::smallint[] @> c.conkey and i.indnkeyatts=cardinality(c.conkey)) as one_to_one
    from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_class rt on rt.oid=c.confrelid
    join pg_namespace n on n.oid=t.relnamespace join pg_namespace rn on rn.oid=rt.relnamespace
    where c.contype='f' and n.nspname='public' and rn.nspname='public' order by c.conname`)
  const typesPath = 'src/lib/supabase/database.generated.ts'
  if (process.argv.includes('--write-types')) throw new Error('Use Supabase gen types for database.generated.ts; WASM does not overwrite official types.')
  const types = await readFile(typesPath, 'utf8')
  for (const c of columns) {
    const body = types.split(c.table_name + ': {')[1]?.split('Row: {')[1]?.split('    }')[0]
    if (!body?.includes(`      ${c.column_name}: `)) throw new Error('Missing fallback column: ' + c.table_name + '.' + c.column_name)
  }
  for (const fk of fks) if (!types.includes(`foreignKeyName: "${fk.conname}"`)) throw new Error('Missing FK: ' + fk.conname)
  const { rows: rpc } = await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and starts_with(proname,'pyr_unibague_')")
  const stagedTypes = await readFile('src/lib/supabase/database.types.ts', 'utf8')
  for (const r of rpc) if (!types.includes(r.proname + ':') && !stagedTypes.includes(r.proname + ':')) throw new Error('Missing RPC: ' + r.proname)
  const { rows: unsafe } = await db.query("select relname from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and starts_with(relname,'PYRUnibague_') and relkind='r' and not relrowsecurity")
  if (unsafe.length) throw new Error('Missing RLS: ' + JSON.stringify(unsafe))
  console.log(`PASS catalog: ${tables.length} tables, ${columns.length} columns, ${fks.length} public FKs, ${rpc.length} RPCs, all RLS enabled`)
  await db.exec(await readFile('supabase/seed.sql', 'utf8'))
  const tests = ['supabase/tests/security.test.sql','supabase/tests/p3.test.sql','supabase/tests/p4.test.sql','supabase/tests/p5_matching.test.sql','supabase/tests/p6a_advisors.test.sql','tests/p6b/database.test.sql','supabase/tests/p6c_assignments.test.sql','supabase/tests/p7_integration.test.sql','supabase/tests/p11.test.sql','supabase/tests/p11_1.test.sql']
  for (const test of tests) {
    const sql = (await readFile(test, 'utf8')).replace('create extension if not exists pgtap with schema extensions;', '')
    try {
      const results = await db.exec(sql)
      const assertions = results.flatMap(r => r.rows).filter(r => ['ok','is','throws_ok','lives_ok'].some(k => k in r))
      console.log(`PASS ${test}: ${assertions.length} supplemental assertions`)
    } catch (error) { console.error('FAIL', test); throw error }
  }
} catch (error) { console.error(error.message); if (error.where) console.error(error.where); process.exitCode = 1 }
finally { await db.close() }
