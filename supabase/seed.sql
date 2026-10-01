-- Structural reference data only; safe to rerun.
insert into public."PYRUnibague_Roles" (code, name, description)
values ('STUDENT', 'Estudiante', 'Espacio de estudiante'),
       ('ORGANIZATION', 'Organización', 'Espacio de organización'),
       ('ADMIN', 'Administración', 'Administración de la plataforma')
on conflict (code) do nothing;
