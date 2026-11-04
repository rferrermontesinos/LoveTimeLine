-- Imitación mínima de lo que Supabase trae de serie (roles, auth, storage, vault, cron, net),
-- para probar la migración en un Postgres vacío sin levantar todo Supabase. Solo para pruebas.
-- Los roles son de todo el servidor: se crean solo si no existen.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated, service_role;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[]; begin _parts := string_to_array(name, '/'); return _parts[1:array_length(_parts, 1) - 1]; end $$;
create schema extensions;
create schema vault;
create view vault.decrypted_secrets as select 'x'::text as name, 'y'::text as decrypted_secret;
create schema cron;
create function cron.schedule(text, text, text) returns bigint language sql as $$ select 1::bigint $$;
create schema net;
create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int) returns bigint language sql as $$ select 1::bigint $$;
