-- Subida colaborativa por enlace (20 de noviembre de 2026).
--
-- Quien hace el mazo comparte un enlace y la familia le manda fotos. Cada foto llega cifrada en
-- el navegador de quien la manda, para la clave pública de quien hizo el mazo: aquí solo se
-- guardan paquetes que nadie más puede leer, hasta que los recoge (y entonces se borran) o hasta
-- que el enlace caduca. Solo la función «colaboracion», con la clave de servicio, toca estas
-- tablas, sus funciones y el bucket: RLS activado y sin políticas para nadie más.
--
-- Se puede aplicar sola (el proyecto de Supabase la tuvo antes que el resto del esquema): activa
-- ella misma pg_cron y pg_net, como la migración inicial.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.invitaciones (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),
  -- Punto P-256 sin comprimir (65 bytes) en base64url.
  clave_publica text not null check (clave_publica ~ '^B[A-Za-z0-9_-]{86}$'),
  -- SHA-256 del token de quien creó el enlace (nunca el token).
  huella_token text not null check (huella_token ~ '^[A-Za-z0-9_-]{43}$'),
  creada_en timestamptz not null default now(),
  caduca_en timestamptz not null
);
create index invitaciones_caduca_en on public.invitaciones (caduca_en);
create index invitaciones_creada_en on public.invitaciones (creada_en);

-- Cada paquete guardado en el bucket, en <invitación>/<id>. «lista» = ya subido del todo.
create table public.aportaciones (
  invitacion_id text not null references public.invitaciones (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{22}$'),
  bytes integer not null check (bytes > 0),
  recibida_en timestamptz not null default now(),
  lista boolean not null default false,
  primary key (invitacion_id, id)
);

alter table public.invitaciones enable row level security;
alter table public.aportaciones enable row level security;
revoke all on public.invitaciones, public.aportaciones from anon, authenticated;

-- Bucket privado y sin políticas: solo la clave de servicio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('aportaciones', 'aportaciones', false, 15728640, array['application/octet-stream'])
on conflict (id) do nothing;

-- ───────────────────────────── Funciones (solo el servicio) ─────────────────────────────
-- Los límites los pasa la función (supabase/functions/colaboracion/servicio.ts, LIMITES). Un
-- cerrojo común hace que dos peticiones a la vez no se salten los límites.

create function public.colab_crear(p_id text, p_clave text, p_huella text, p_caduca timestamptz, p_max_activos integer, p_max_hora integer)
returns text
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('colaboracion'));
  if (select count(*) from public.invitaciones i where i.caduca_en > now()) >= p_max_activos
    or (select count(*) from public.invitaciones i where i.creada_en > now() - interval '1 hour') >= p_max_hora then
    return 'lleno';
  end if;
  insert into public.invitaciones (id, clave_publica, huella_token, caduca_en) values (p_id, p_clave, p_huella, p_caduca);
  return 'ok';
end;
$$;

create function public.colab_leer(p_id text)
returns table (clave_publica text, huella_token text, caduca_en timestamptz)
language sql stable set search_path = '' as $$
  select i.clave_publica, i.huella_token, i.caduca_en from public.invitaciones i where i.id = p_id;
$$;

-- Comprueba los límites y apunta la aportación (sin confirmar) en un solo paso.
create function public.colab_reservar(p_inv text, p_id text, p_bytes integer, p_max_fotos integer, p_max_bytes_enlace bigint, p_max_bytes_total bigint)
returns text
language plpgsql set search_path = '' as $$
declare
  v_caduca timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('colaboracion'));
  select i.caduca_en into v_caduca from public.invitaciones i where i.id = p_inv;
  if not found then return 'no-existe'; end if;
  if v_caduca <= now() then return 'caducada'; end if;
  -- Las reservas que se quedaron a medias hace más de una hora ya no cuentan.
  delete from public.aportaciones a where a.invitacion_id = p_inv and not a.lista and a.recibida_en < now() - interval '1 hour';
  if (select count(*) from public.aportaciones a where a.invitacion_id = p_inv) >= p_max_fotos
    or (select coalesce(sum(a.bytes), 0) from public.aportaciones a where a.invitacion_id = p_inv) + p_bytes > p_max_bytes_enlace
    or (select coalesce(sum(a.bytes), 0) from public.aportaciones a) + p_bytes > p_max_bytes_total then
    return 'lleno';
  end if;
  insert into public.aportaciones (invitacion_id, id, bytes) values (p_inv, p_id, p_bytes);
  return 'ok';
end;
$$;

create function public.colab_confirmar(p_inv text, p_id text)
returns void
language sql set search_path = '' as $$
  update public.aportaciones set lista = true where invitacion_id = p_inv and id = p_id;
$$;

create function public.colab_quitar(p_inv text, p_id text)
returns boolean
language plpgsql set search_path = '' as $$
begin
  delete from public.aportaciones a where a.invitacion_id = p_inv and a.id = p_id;
  return found;
end;
$$;

create function public.colab_listar(p_inv text)
returns table (id text, bytes integer, recibida_en timestamptz)
language sql stable set search_path = '' as $$
  select a.id, a.bytes, a.recibida_en
  from public.aportaciones a
  where a.invitacion_id = p_inv and a.lista
  order by a.recibida_en, a.id;
$$;

create function public.colab_borrar(p_inv text)
returns void
language sql set search_path = '' as $$
  delete from public.invitaciones where id = p_inv;
$$;

create function public.colab_caducadas(p_limite integer default 50)
returns table (id text)
language sql stable set search_path = '' as $$
  select i.id from public.invitaciones i where i.caduca_en <= now() order by i.caduca_en limit p_limite;
$$;

revoke execute on function
  public.colab_crear(text, text, text, timestamptz, integer, integer),
  public.colab_leer(text),
  public.colab_reservar(text, text, integer, integer, bigint, bigint),
  public.colab_confirmar(text, text),
  public.colab_quitar(text, text),
  public.colab_listar(text),
  public.colab_borrar(text),
  public.colab_caducadas(integer)
from public, anon, authenticated;
grant execute on function
  public.colab_crear(text, text, text, timestamptz, integer, integer),
  public.colab_leer(text),
  public.colab_reservar(text, text, integer, integer, bigint, bigint),
  public.colab_confirmar(text, text),
  public.colab_quitar(text, text),
  public.colab_listar(text),
  public.colab_borrar(text),
  public.colab_caducadas(integer)
to service_role;

-- Tarea diaria (03:45 UTC): la función borra los enlaces caducados y sus paquetes. Usa el secreto
-- «project_url» de Vault (ver la migración inicial: se crea una vez con vault.create_secret). Además,
-- cada enlace nuevo purga de paso.
select cron.schedule(
  'purgar-aportaciones-diario',
  '45 3 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/colaboracion/purgar',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
