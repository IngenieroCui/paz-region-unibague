-- Disposable isolated database only; all data rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into "PYRUnibague_Organizations"(id,legal_name,tax_id,status) values
 ('b1110000-0000-0000-0000-000000000001','TEST P11.1 Uno','P11.1-123','pending_review'),
 ('b1110000-0000-0000-0000-000000000002','TEST P11.1 Dos','P11.1-456','pending_review');
select throws_ok($$insert into "PYRUnibague_Organizations"(legal_name,status) values('  test p11.1 uno  ','pending_review')$$,'23505',null,'INSERT rejects normalized legal name');
select throws_ok($$insert into "PYRUnibague_Organizations"(legal_name,tax_id,status) values('TEST P11.1 Tres',' P111.123 ','pending_review')$$,'23505',null,'INSERT rejects normalized tax id');
select throws_ok($$update "PYRUnibague_Organizations" set legal_name='  test p11.1 uno  ' where id='b1110000-0000-0000-0000-000000000002'$$,'23505',null,'UPDATE legal name alone rejects normalized duplicate');
select throws_ok($$update "PYRUnibague_Organizations" set tax_id=' P111 123 ' where id='b1110000-0000-0000-0000-000000000002'$$,'23505',null,'UPDATE tax rejects normalized duplicate');
select lives_ok($$update "PYRUnibague_Organizations" set legal_name='TEST P11.1 Dos actualizado',tax_id='P11.1-789' where id='b1110000-0000-0000-0000-000000000002'$$,'distinct identity may be updated');
select lives_ok($$update "PYRUnibague_Organizations" set legal_name=' test p11.1 uno ',tax_id=' P111123 ' where id='b1110000-0000-0000-0000-000000000001'$$,'own normalized identity may remain unchanged');
select lives_ok($$insert into "PYRUnibague_Organizations"(legal_name,tax_id,status) values('TEST P11.1 Sin NIT A',null,'pending_review'),('TEST P11.1 Sin NIT B',' .- ','pending_review')$$,'optional empty tax ids are allowed');
select is((select count(*)::integer from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname in ('p11_organization_tax_normalized','p11_organization_legal_trimmed') and i.indisunique),2,'both unique indexes enforce concurrent identity uniqueness');
select * from finish();
rollback;
