-- Esquema inicial del portal (prototipo). Proyecto de Supabase en región UE.
--
-- · Catálogo (packs, ampliación, extras, mecánicas, países): lectura pública, escritura solo
--   con la clave de servicio o desde el panel. Los importes van en céntimos y con moneda.
-- · Datos de clientes (perfiles, mazos, cartas, consentimientos, pedidos): cada persona ve
--   solo lo suyo (RLS). La administración ve todo a través de es_admin().
-- · Fotos y archivos de impresión: buckets privados, acceso con URLs firmadas de corta
--   duración y borrado automático 60 días después del envío (función purgar-fotos).
--
-- Los datos del catálogo se cargan con supabase/seed.sql (pnpm db:seed lo genera).

create extension if not exists pgcrypto with schema extensions;

-- ───────────────────────────── Catálogo ─────────────────────────────

create table public.ajustes_catalogo (
  id smallint primary key default 1 check (id = 1),
  version integer not null default 1,
  moneda char(3) not null default 'EUR',
  bloque_cartas integer not null check (bloque_cartas > 0),
  precio_bloque_cents integer not null check (precio_bloque_cents >= 0),
  max_cartas_foto integer not null check (max_cartas_foto > 0),
  capacidad_caja integer not null check (capacidad_caja > 0),
  precio_caja_extra_cents integer not null check (precio_caja_extra_cents >= 0),
  actualizado_en timestamptz not null default now()
);
comment on table public.ajustes_catalogo is 'Fila única: ampliaciones por bloques de cartas y cajas.';

create table public.paises (
  codigo char(2) primary key check (codigo = upper(codigo)),
  activo boolean not null default false,
  moneda char(3) not null,
  envio_incluido boolean not null default true,
  dias_min integer not null check (dias_min > 0),
  dias_max integer not null check (dias_max >= dias_min)
);
comment on table public.paises is 'Países de envío. Cada país nuevo se revisa (RGPD, impuestos, envío) antes de activarlo.';

create table public.packs (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  orden integer not null default 0,
  activo boolean not null default true,
  cartas integer not null check (cartas > 0),
  precio_cents integer not null check (precio_cents >= 0),
  moneda char(3) not null default 'EUR',
  estilo_por_defecto text not null,
  nombre jsonb not null,
  descripcion jsonb not null default '{}'::jsonb
);
comment on column public.packs.cartas is 'Cartas con foto incluidas; también el mínimo para poder pagar.';

create table public.extras (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  orden integer not null default 0,
  activo boolean not null default true,
  precio_tipo text not null check (precio_tipo in ('fijo', 'porcentajeMazo')),
  precio_cents integer check (precio_cents >= 0),
  porcentaje integer check (porcentaje between 0 and 100),
  cartas_fisicas integer check (cartas_fisicas > 0),
  nombre jsonb not null,
  descripcion jsonb not null default '{}'::jsonb,
  check (
    (precio_tipo = 'fijo' and precio_cents is not null)
    or (precio_tipo = 'porcentajeMazo' and porcentaje is not null)
  )
);

create table public.mecanicas (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  orden integer not null default 0,
  activo boolean not null default true,
  tipo text not null check (tipo in ('icono', 'cartas')),
  icono text,
  asignacion text check (asignacion in ('manual', 'automatica')),
  max_cartas integer check (max_cartas > 0),
  cada_n integer check (cada_n > 0),
  cartas_fisicas integer check (cartas_fisicas > 0),
  por_defecto boolean not null default false,
  precio_cents integer not null default 0 check (precio_cents >= 0),
  nombre jsonb not null,
  descripcion jsonb not null default '{}'::jsonb
);

alter table public.ajustes_catalogo enable row level security;
alter table public.paises enable row level security;
alter table public.packs enable row level security;
alter table public.extras enable row level security;
alter table public.mecanicas enable row level security;

create policy "catálogo: lectura pública" on public.ajustes_catalogo for select to anon, authenticated using (true);
create policy "catálogo: lectura pública" on public.paises for select to anon, authenticated using (true);
create policy "catálogo: lectura pública de lo activo" on public.packs for select to anon, authenticated using (activo);
create policy "catálogo: lectura pública de lo activo" on public.extras for select to anon, authenticated using (activo);
create policy "catálogo: lectura pública de lo activo" on public.mecanicas for select to anon, authenticated using (activo);

-- ───────────────────────────── Personas ─────────────────────────────

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol text not null default 'cliente' check (rol in ('cliente', 'admin')),
  idioma text not null default 'es',
  creado_en timestamptz not null default now()
);

-- Cada alta (enlace mágico) crea su perfil de cliente.
create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and rol = 'admin');
$$;

alter table public.perfiles enable row level security;
create policy "perfiles: cada cual el suyo" on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select public.es_admin()));
create policy "perfiles: cada cual cambia el suyo" on public.perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Nadie se cambia el rol a sí mismo: solo el idioma es editable desde el cliente.
revoke update on public.perfiles from anon, authenticated;
grant update (idioma) on public.perfiles to authenticated;

-- ───────────────────────────── Mazos y cartas ─────────────────────────────

create table public.mazos (
  id uuid primary key default gen_random_uuid(),
  propietario uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pack_id text not null references public.packs (id),
  estilo_id text not null,
  tinta_id text,
  titulo text not null default '' check (char_length(titulo) <= 32),
  dedicatoria text not null default '' check (char_length(dedicatoria) <= 140),
  tono text not null default 'color',
  idioma_mazo text not null default 'es',
  mecanicas text[] not null default '{}',
  extras text[] not null default '{}',
  portada_carta_id uuid,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index mazos_propietario_idx on public.mazos (propietario);

create table public.cartas (
  id uuid primary key default gen_random_uuid(),
  mazo_id uuid not null references public.mazos (id) on delete cascade,
  orden integer not null default 0,
  -- Fecha en ISO con su precisión: «2019», «2019-08» o «2019-08-14». Obligatoria para pagar,
  -- no para guardar el borrador.
  fecha text check (fecha ~ '^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$'),
  fuente_fecha text check (fuente_fecha in ('exif', 'nombre', 'archivo', 'manual')),
  confianza text check (confianza in ('alta', 'media', 'baja')),
  revisar boolean not null default false,
  descripcion text not null default '' check (char_length(descripcion) <= 90),
  descripcion_en_anverso boolean not null default false,
  nombre_archivo text not null,
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  ancho_original integer not null check (ancho_original > 0),
  alto_original integer not null check (alto_original > 0),
  recorte_anverso jsonb,
  recorte_reverso jsonb,
  adornos jsonb not null default '[]'::jsonb,
  destacada boolean not null default false,
  ppp_confirmado boolean not null default false,
  -- Rutas dentro de los buckets privados: <propietario>/<mazo>/<carta>.<ext>
  ruta_original text,
  ruta_copia text,
  creado_en timestamptz not null default now(),
  unique (mazo_id, hash)
);
create index cartas_mazo_idx on public.cartas (mazo_id, orden);

alter table public.mazos
  add constraint mazos_portada_fk foreign key (portada_carta_id) references public.cartas (id) on delete set null;

create function public.es_mi_mazo(m uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mazos where id = m and propietario = (select auth.uid()));
$$;

alter table public.mazos enable row level security;
create policy "mazos: el propietario los ve" on public.mazos for select to authenticated
  using (propietario = (select auth.uid()) or (select public.es_admin()));
create policy "mazos: el propietario los crea" on public.mazos for insert to authenticated
  with check (propietario = (select auth.uid()));
create policy "mazos: el propietario los cambia" on public.mazos for update to authenticated
  using (propietario = (select auth.uid())) with check (propietario = (select auth.uid()));
create policy "mazos: el propietario los borra" on public.mazos for delete to authenticated
  using (propietario = (select auth.uid()));

alter table public.cartas enable row level security;
create policy "cartas: las del propio mazo" on public.cartas for select to authenticated
  using ((select public.es_mi_mazo(mazo_id)) or (select public.es_admin()));
create policy "cartas: crear en el propio mazo" on public.cartas for insert to authenticated
  with check ((select public.es_mi_mazo(mazo_id)));
create policy "cartas: cambiar en el propio mazo" on public.cartas for update to authenticated
  using ((select public.es_mi_mazo(mazo_id))) with check ((select public.es_mi_mazo(mazo_id)));
create policy "cartas: borrar en el propio mazo" on public.cartas for delete to authenticated
  using ((select public.es_mi_mazo(mazo_id)));

-- ───────────────────────────── Consentimientos (RGPD) ─────────────────────────────

-- Registro inmutable: cada aceptación es una fila nueva; no se edita ni se borra desde el cliente.
create table public.consentimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mazo_id uuid references public.mazos (id) on delete set null,
  tipo text not null check (tipo in ('fotos', 'privacidad', 'comunicaciones')),
  version_texto text not null,
  idioma text not null,
  aceptado_en timestamptz not null default now()
);
create index consentimientos_usuario_idx on public.consentimientos (usuario_id);

alter table public.consentimientos enable row level security;
create policy "consentimientos: ver los propios" on public.consentimientos for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_admin()));
create policy "consentimientos: registrar los propios" on public.consentimientos for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- ───────────────────────────── Pedidos ─────────────────────────────

-- Los crea el servidor (clave de servicio) tras recalcular el precio; el navegador nunca
-- fija importes. El cliente solo puede leer los suyos.
create table public.pedidos (
  id text primary key check (id ~ '^P-[A-Z0-9]+-[A-F0-9]{6}$'),
  usuario_id uuid references auth.users (id) on delete set null,
  mazo_id uuid references public.mazos (id) on delete set null,
  -- Identificador del mazo en el navegador (prototipo local, sin cuenta).
  mazo_ref text,
  estado text not null default 'pendiente'
    check (estado in ('simulado', 'pendiente', 'pagado', 'en_imprenta', 'enviado', 'entregado', 'cancelado')),
  modo text not null check (modo in ('simulado', 'stripe')),
  pack_id text not null references public.packs (id),
  cartas_foto integer not null check (cartas_foto >= 0),
  cartas_fisicas integer not null check (cartas_fisicas > 0),
  extras text[] not null default '{}',
  mecanicas text[] not null default '{}',
  total_cents integer not null check (total_cents >= 0),
  moneda char(3) not null,
  idioma text not null,
  pais_envio char(2) references public.paises (codigo),
  stripe_session_id text unique,
  creado_en timestamptz not null default now(),
  pagado_en timestamptz,
  enviado_en timestamptz,
  -- Momento en que se borraron fotos y archivo de impresión (60 días tras el envío).
  purgado_en timestamptz
);
create index pedidos_usuario_idx on public.pedidos (usuario_id);
create index pedidos_purga_idx on public.pedidos (enviado_en) where purgado_en is null;

alter table public.pedidos enable row level security;
create policy "pedidos: cada cual los suyos" on public.pedidos for select to authenticated
  using (usuario_id = (select auth.uid()) or (select public.es_admin()));
create policy "pedidos: la administración los actualiza" on public.pedidos for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- ───────────────────────────── Almacenamiento ─────────────────────────────

-- Buckets privados. Rutas: <propietario>/<mazo>/<archivo> en las fotos y <pedido>/<archivo>
-- en impresión. Se accede con URLs firmadas de pocos minutos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos-originales', 'fotos-originales', false, 52428800,
    array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']),
  ('fotos-copias', 'fotos-copias', false, 15728640, array['image/jpeg', 'image/webp']),
  ('impresion', 'impresion', false, 1073741824, array['application/pdf'])
on conflict (id) do nothing;

create policy "fotos: subir a la carpeta propia" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('fotos-originales', 'fotos-copias')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "fotos: ver las propias" on storage.objects for select to authenticated
  using (
    bucket_id in ('fotos-originales', 'fotos-copias')
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.es_admin()))
  );
create policy "fotos: reemplazar las propias" on storage.objects for update to authenticated
  using (
    bucket_id in ('fotos-originales', 'fotos-copias')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('fotos-originales', 'fotos-copias')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "fotos: borrar las propias" on storage.objects for delete to authenticated
  using (
    bucket_id in ('fotos-originales', 'fotos-copias')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "impresión: solo la administración" on storage.objects for select to authenticated
  using (bucket_id = 'impresion' and (select public.es_admin()));

-- ───────────────────────────── Borrado a los 60 días ─────────────────────────────

-- Pedidos enviados hace más de N días cuyos archivos siguen guardados. Solo la usa la
-- función purgar-fotos con la clave de servicio.
create function public.pedidos_a_purgar(dias integer default 60)
returns table (pedido_id text, usuario_id uuid, mazo_id uuid)
language sql stable security definer set search_path = '' as $$
  select p.id, p.usuario_id, p.mazo_id
  from public.pedidos p
  where p.enviado_en is not null
    and p.purgado_en is null
    and p.enviado_en < now() - make_interval(days => dias)
  order by p.enviado_en
  limit 200;
$$;
revoke execute on function public.pedidos_a_purgar(integer) from public, anon, authenticated;
grant execute on function public.pedidos_a_purgar(integer) to service_role;

-- Tarea diaria (03:15 UTC) que llama a la función purgar-fotos. Necesita dos secretos en
-- Vault, que se crean a mano una sola vez (ver docs/portal.md):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<secreto largo y aleatorio>', 'purga_secreto');
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'purgar-fotos-diario',
  '15 3 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purgar-fotos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-purga-secreto', (select decrypted_secret from vault.decrypted_secrets where name = 'purga_secreto')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
