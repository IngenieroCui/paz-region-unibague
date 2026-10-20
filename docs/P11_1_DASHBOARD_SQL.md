# P11.1 — Procedimiento SQL autorizado

Proyecto exclusivo: `unxiuzkhxlzneywtnuvf`. No ejecutar sobre otro proyecto. El conector rechazó la consulta del historial; no se afirma que ninguna migración de este sprint esté aplicada en remoto. La clave administrativa de Auth/Data API no permite ejecutar este SQL.

## 1. Verificar antes de ejecutar

Un administrador autorizado debe abrir el [SQL Editor del proyecto](https://supabase.com/dashboard/project/unxiuzkhxlzneywtnuvf/sql/new), confirmar la referencia del proyecto y ejecutar:

```sql
select version,name from supabase_migrations.schema_migrations
where version in ('20261016154045','20261020122421','20261020134931')
order by version;

select to_regprocedure('public.pyr_unibague_external_registration_ready()') as registration_gate,
       to_regprocedure('public.pyr_unibague_submit_organization(uuid)') as submission;

select tgname,pg_get_triggerdef(oid)
from pg_trigger
where tgrelid='public."PYRUnibague_Organizations"'::regclass and not tgisinternal;

-- Solo cantidades; no exportar identificaciones tributarias ni nombres.
select count(*) as legal_name_duplicate_groups from (
 select 1 from public."PYRUnibague_Organizations"
 group by lower(btrim(legal_name)) having count(*)>1
) d;
select count(*) as tax_duplicate_groups from (
 select 1 from public."PYRUnibague_Organizations"
 where nullif(regexp_replace(lower(btrim(tax_id)),'[[:space:].-]','','g'),'') is not null
 group by regexp_replace(lower(btrim(tax_id)),'[[:space:].-]','','g') having count(*)>1
) d;
```

Si hay duplicados, coordinación debe reconciliarlos preservando contactos, documentos, proyectos e historial. La migración se detiene de forma transaccional: no elimina ni fusiona datos automáticamente. Si los objetos existen pero falta el registro de su versión, comparar sus definiciones con Git antes de decidir; no reaplicar funciones a ciegas.

## 2. Ejecutar solo versiones ausentes

Pegar el contenido íntegro de cada archivo pendiente, uno por ejecución y en este orden. Cada archivo incluye su propia transacción:

1. `supabase/migrations/20261016154045_p11_dual_auth_organizations.sql`.
2. `supabase/migrations/20261020122421_p11_review_safety.sql`.
3. `supabase/migrations/20261020134931_p11_1_organization_identity.sql`.

P11.1 conserva las dos migraciones previas sin editar. La correctiva reemplaza la función y el trigger para INSERT y UPDATE de `legal_name,tax_id`, y convierte los dos índices de identidad existentes en únicos. El NIT vacío sigue permitido. Planificar una ventana: la creación de índices y el cambio de trigger adquieren bloqueos de la tabla. No se añaden índices de rendimiento sin planes de ejecución remotos.

## 3. Verificar y registrar el historial

```sql
select pg_get_triggerdef(oid) from pg_trigger
where tgrelid='public."PYRUnibague_Organizations"'::regclass
and tgname='p11_organization_identity';

select indexname,indexdef from pg_indexes
where schemaname='public' and indexname in
('p11_organization_tax_normalized','p11_organization_legal_trimmed');

select public.pyr_unibague_external_registration_ready(); -- debe permanecer false
select key,value->>'enabled' as enabled
from public."PYRUnibague_SystemConfigurations" where key='p11_external_registration';
```

SQL Editor no registra automáticamente la versión en el historial del CLI. Después de comprobar los objetos y sus pruebas, registrar exclusivamente las versiones realmente ejecutadas con un CLI autenticado y conexión autorizada. Consultar primero `supabase migration repair --help`; la sintaxis comprobada es:

```text
supabase migration repair --project-ref unxiuzkhxlzneywtnuvf --status applied VERSION_EJECUTADA
supabase migration list --project-ref unxiuzkhxlzneywtnuvf
```

Usar el mecanismo seguro de credenciales del CLI; no poner contraseñas en argumentos ni pegarlas en el chat. No marcar versiones que solo estén preparadas en Git.

Ejecutar pgTAP en una instancia desechable autorizada con el mismo esquema: `supabase/tests/p11.test.sql` y `supabase/tests/p11_1.test.sql` conservan rollback. La prueba opcional `tests/p11-1/concurrency.test.mjs` usa dos conexiones y aislamiento repeatable read; exige driver PostgreSQL, URL de pruebas y `P11_1_ALLOW_DISPOSABLE_TESTS=yes`. No utilizar una base de producción para fixtures desechables. Revisar Advisors de seguridad/rendimiento, planes de las consultas realmente lentas y regenerar tipos oficiales con el CLI antes de declarar cerrado el backend remoto.

## 4. Auth y proyecto compartido

La lectura pública actual continúa mostrando `disable_signup=false`, `mailer_autoconfirm=true` y Google desactivado. El frontend cerrado no protege el endpoint público preexistente. No se modificó la configuración global: no fue posible comprobar todas las aplicaciones consumidoras del proyecto, y el canal de gestión no está autorizado.

TI debe inventariar aplicaciones, URLs autorizadas y consumidores antes de aprobar específicamente un cierre global de signup. Si es compartido, acordar la política con sus responsables. La función privada del hook está preparada pero **crear la función no instala el hook en Auth**: su instalación también debe verificarse desde Dashboard.

Mantener cerrado el gate de la aplicación y no habilitar Google. Antes de autorizar el registro externo: SMTP con entrega real, confirmación de correo, CAPTCHA, rate limits, hook instalado y probado con gate cerrado, requisitos documentales y textos institucionales aprobados. El hook y el onboarding no conceden roles universitarios ni aprobación de organizaciones. Validar también el conflicto de interés de ADMIN con membresía propia.

Referencias: [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [configuración de Auth](https://supabase.com/docs/guides/auth/general-configuration), [índices únicos de PostgreSQL](https://www.postgresql.org/docs/current/indexes-unique.html).
