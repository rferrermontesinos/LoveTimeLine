-- Comprueba las reglas de acceso (RLS) y las restricciones de la migración inicial.
-- Se ejecuta con scripts/probar-bd.sh sobre una base recién creada; cualquier fallo aborta.
\set ON_ERROR_STOP 1
\o /dev/null
set client_min_messages = notice;

create schema pruebas;
grant usage on schema pruebas to anon, authenticated, service_role;
create function pruebas.comprobar(condicion boolean, mensaje text) returns void
language plpgsql as $$
begin
  if condicion is not true then raise exception 'FALLA: %', mensaje; end if;
  raise notice 'ok: %', mensaje;
end;
$$;
grant execute on function pruebas.comprobar(boolean, text) to anon, authenticated, service_role;

-- Tres personas: A y B clientes, C administración.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@ejemplo.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@ejemplo.test'),
  ('33333333-3333-3333-3333-333333333333', 'c@ejemplo.test');
update public.perfiles set rol = 'admin' where id = '33333333-3333-3333-3333-333333333333';
select pruebas.comprobar((select count(*) from public.perfiles) = 3, 'cada alta crea su perfil');

-- ── A: su mazo, su carta y su foto ──
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.mazos (id, pack_id, estilo_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'pareja', 'pareja');
insert into public.cartas (mazo_id, fecha, nombre_archivo, hash, ancho_original, alto_original)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '2019-08', 'IMG_1.jpg', repeat('a', 64), 4000, 3000);
insert into storage.objects (bucket_id, name)
  values ('fotos-originales', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/c1.jpg');
select pruebas.comprobar((select count(*) from public.mazos) = 1, 'A ve su mazo');
select pruebas.comprobar((select count(*) from public.cartas) = 1, 'A ve su carta');
select pruebas.comprobar((select count(*) from storage.objects) = 1, 'A ve su foto');

do $$ begin
  insert into public.cartas (mazo_id, fecha, nombre_archivo, hash, ancho_original, alto_original)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2019-13', 'x.jpg', repeat('b', 64), 10, 10);
  raise exception 'FALLA: se aceptó el mes 13';
exception when check_violation then raise notice 'ok: rechaza fechas imposibles';
end $$;

do $$ begin
  insert into public.cartas (mazo_id, fecha, descripcion, nombre_archivo, hash, ancho_original, alto_original)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2019', repeat('x', 91), 'x.jpg', repeat('c', 64), 10, 10);
  raise exception 'FALLA: se aceptó una descripción de 91 caracteres';
exception when check_violation then raise notice 'ok: la descripción no pasa de 90 caracteres';
end $$;

do $$ begin
  update public.perfiles set rol = 'admin' where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'FALLA: un cliente se ha hecho admin';
exception when insufficient_privilege then raise notice 'ok: nadie se cambia el rol';
end $$;

do $$ begin
  insert into storage.objects (bucket_id, name) values ('fotos-originales', '22222222-2222-2222-2222-222222222222/x/c1.jpg');
  raise exception 'FALLA: A subió a la carpeta de B';
exception when insufficient_privilege then raise notice 'ok: solo se sube a la carpeta propia';
end $$;

update public.packs set precio_cents = 1 where id = 'pareja';
reset role;
select pruebas.comprobar((select precio_cents from public.packs where id = 'pareja') = 4900, 'un cliente no cambia precios');

-- ── B: no ve ni toca nada de A ──
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pruebas.comprobar((select count(*) from public.mazos) = 0, 'B no ve mazos ajenos');
select pruebas.comprobar((select count(*) from public.cartas) = 0, 'B no ve cartas ajenas');
select pruebas.comprobar((select count(*) from storage.objects) = 0, 'B no ve fotos ajenas');
select pruebas.comprobar((select count(*) from public.packs) = 2, 'B lee el catálogo');
do $$ begin
  insert into public.cartas (mazo_id, fecha, nombre_archivo, hash, ancho_original, alto_original)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2020', 'intruso.jpg', repeat('d', 64), 10, 10);
  raise exception 'FALLA: B escribió en el mazo de A';
exception when insufficient_privilege then raise notice 'ok: B no escribe en mazos ajenos';
end $$;
reset role;

-- ── Sin sesión: catálogo sí, lo demás no ──
set role anon;
select pruebas.comprobar((select count(*) from public.packs) = 2, 'el catálogo es público');
select pruebas.comprobar((select count(*) from public.pedidos) = 0, 'los pedidos no son públicos');
do $$ begin
  perform public.pedidos_a_purgar(60);
  raise exception 'FALLA: cualquiera puede listar pedidos a purgar';
exception when insufficient_privilege then raise notice 'ok: la purga solo la llama el servicio';
end $$;
reset role;

-- ── Servicio: pedidos y purga a los 60 días ──
set role service_role;
insert into public.pedidos (id, usuario_id, mazo_id, estado, modo, pack_id, cartas_foto, cartas_fisicas, total_cents, moneda, idioma, enviado_en)
  values ('P-ABC123-0A1B2C', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'enviado', 'simulado', 'pareja', 40, 47, 4900, 'EUR', 'es', now() - interval '61 days'),
         ('P-ABC124-0A1B2D', '22222222-2222-2222-2222-222222222222', null, 'enviado', 'simulado', 'pareja', 40, 47, 4900, 'EUR', 'es', now() - interval '10 days');
select pruebas.comprobar(
  (select array_agg(pedido_id) from public.pedidos_a_purgar(60)) = array['P-ABC123-0A1B2C'],
  'solo se purgan los pedidos enviados hace más de 60 días'
);
reset role;

-- ── Cada cual ve sus pedidos; la administración, todos ──
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select pruebas.comprobar((select count(*) from public.pedidos) = 1, 'A ve solo su pedido');
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select pruebas.comprobar((select count(*) from public.pedidos) = 2, 'la administración ve todos los pedidos');
select pruebas.comprobar((select count(*) from public.mazos) = 1, 'la administración ve todos los mazos');
reset role;
