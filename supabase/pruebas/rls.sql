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
insert into public.mazos (id, pack_id, estilo_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'pequeno', 'naipe');
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

insert into public.cartas (mazo_id, tipo, fecha, descripcion)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'texto', '1958-03', 'Nació el abuelo Pepe');
select pruebas.comprobar((select count(*) from public.cartas where tipo = 'texto') = 1, 'un recuerdo sin foto se guarda con fecha y texto');

do $$ begin
  insert into public.cartas (mazo_id, tipo, fecha, descripcion) values ('aaaaaaaa-0000-0000-0000-000000000001', 'texto', '2001', '  ');
  raise exception 'FALLA: se aceptó un recuerdo sin foto y sin texto';
exception when check_violation then raise notice 'ok: un recuerdo sin foto necesita texto';
end $$;

do $$ begin
  insert into public.cartas (mazo_id, tipo, fecha) values ('aaaaaaaa-0000-0000-0000-000000000001', 'foto', '2001');
  raise exception 'FALLA: se aceptó una carta de foto sin archivo';
exception when check_violation then raise notice 'ok: una carta de foto necesita su archivo';
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

update public.packs set precio_cents = 1 where id = 'pequeno';
reset role;
select pruebas.comprobar((select precio_cents from public.packs where id = 'pequeno') = 4900, 'un cliente no cambia precios');

-- ── B: no ve ni toca nada de A ──
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select pruebas.comprobar((select count(*) from public.mazos) = 0, 'B no ve mazos ajenos');
select pruebas.comprobar((select count(*) from public.cartas) = 0, 'B no ve cartas ajenas');
select pruebas.comprobar((select count(*) from storage.objects) = 0, 'B no ve fotos ajenas');
select pruebas.comprobar((select count(*) from public.packs) = 3, 'B lee el catálogo (solo los packs activos)');
do $$ begin
  insert into public.cartas (mazo_id, fecha, nombre_archivo, hash, ancho_original, alto_original)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '2020', 'intruso.jpg', repeat('d', 64), 10, 10);
  raise exception 'FALLA: B escribió en el mazo de A';
exception when insufficient_privilege then raise notice 'ok: B no escribe en mazos ajenos';
end $$;
reset role;

-- ── Sin sesión: catálogo sí, lo demás no ──
set role anon;
select pruebas.comprobar((select count(*) from public.packs) = 3, 'el catálogo activo es público');
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
  values ('P-ABC123-0A1B2C', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'enviado', 'simulado', 'pequeno', 40, 47, 4900, 'EUR', 'es', now() - interval '61 days'),
         ('P-ABC124-0A1B2D', '22222222-2222-2222-2222-222222222222', null, 'enviado', 'simulado', 'pequeno', 40, 47, 4900, 'EUR', 'es', now() - interval '10 days');
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

-- ── Subida colaborativa: tablas, funciones y límites, solo para el servicio ──
set role anon;
do $$ begin
  perform count(*) from public.invitaciones;
  raise exception 'FALLA: cualquiera lee los enlaces de la subida colaborativa';
exception when insufficient_privilege then raise notice 'ok: los enlaces no son públicos';
end $$;
do $$ begin
  perform count(*) from public.aportaciones;
  raise exception 'FALLA: cualquiera lee las aportaciones';
exception when insufficient_privilege then raise notice 'ok: las aportaciones no son públicas';
end $$;
do $$ begin
  perform public.colab_reservar('AAAAAAAAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBBBBBBBB', 100, 300, 1000000, 1000000);
  raise exception 'FALLA: cualquiera puede reservar sitio en un enlace';
exception when insufficient_privilege then raise notice 'ok: solo el servicio reserva sitio';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  perform public.colab_leer('AAAAAAAAAAAAAAAAAAAAAA');
  raise exception 'FALLA: una sesión cualquiera lee enlaces';
exception when insufficient_privilege then raise notice 'ok: una sesión no lee enlaces';
end $$;
do $$ begin
  insert into public.invitaciones (id, clave_publica, huella_token, caduca_en)
    values ('AAAAAAAAAAAAAAAAAAAAAA', 'B' || repeat('A', 86), repeat('A', 43), now() + interval '1 day');
  raise exception 'FALLA: una sesión crea enlaces sin pasar por el servicio';
exception when insufficient_privilege then raise notice 'ok: los enlaces solo los crea el servicio';
end $$;
reset role;

set role service_role;
select pruebas.comprobar(
  public.colab_crear('AAAAAAAAAAAAAAAAAAAAAA', 'B' || repeat('A', 86), repeat('A', 43), now() + interval '14 days', 2, 10) = 'ok'
  and public.colab_crear('CCCCCCCCCCCCCCCCCCCCCC', 'B' || repeat('C', 86), repeat('C', 43), now() + interval '14 days', 2, 10) = 'ok',
  'el servicio crea enlaces'
);
select pruebas.comprobar(
  public.colab_crear('DDDDDDDDDDDDDDDDDDDDDD', 'B' || repeat('D', 86), repeat('D', 43), now() + interval '14 days', 2, 10) = 'lleno',
  'no se pasa de los enlaces activos a la vez'
);
select pruebas.comprobar(
  public.colab_crear('DDDDDDDDDDDDDDDDDDDDDD', 'B' || repeat('D', 86), repeat('D', 43), now() + interval '14 days', 10, 2) = 'lleno',
  'no se pasa de los enlaces nuevos por hora'
);
do $$ begin
  perform public.colab_crear('corto', 'B' || repeat('A', 86), repeat('A', 43), now(), 10, 10);
  raise exception 'FALLA: se aceptó un id de enlace mal formado';
exception when check_violation then raise notice 'ok: rechaza ids de enlace mal formados';
end $$;
do $$ begin
  perform public.colab_crear('EEEEEEEEEEEEEEEEEEEEEE', 'no es una clave', repeat('A', 43), now(), 10, 10);
  raise exception 'FALLA: se aceptó una clave pública mal formada';
exception when check_violation then raise notice 'ok: rechaza claves públicas mal formadas';
end $$;

select pruebas.comprobar(
  public.colab_reservar('AAAAAAAAAAAAAAAAAAAAAA', 'a0000000000000000000a1', 100, 2, 1000, 5000) = 'ok'
  and public.colab_reservar('AAAAAAAAAAAAAAAAAAAAAA', 'a0000000000000000000a2', 100, 2, 1000, 5000) = 'ok',
  'reserva sitio para dos fotos'
);
select pruebas.comprobar(public.colab_reservar('AAAAAAAAAAAAAAAAAAAAAA', 'a0000000000000000000a3', 100, 2, 1000, 5000) = 'lleno', 'no pasa de las fotos esperando en un enlace');
select pruebas.comprobar(public.colab_reservar('CCCCCCCCCCCCCCCCCCCCCC', 'c0000000000000000000c1', 1001, 300, 1000, 5000) = 'lleno', 'no pasa de los bytes de un enlace');
select pruebas.comprobar(public.colab_reservar('CCCCCCCCCCCCCCCCCCCCCC', 'c0000000000000000000c1', 900, 300, 1000, 1000) = 'lleno', 'no pasa de los bytes entre todos los enlaces');
select pruebas.comprobar(public.colab_reservar('ZZZZZZZZZZZZZZZZZZZZZZ', 'z0000000000000000000z1', 100, 300, 1000, 5000) = 'no-existe', 'un enlace que no existe no admite fotos');

select pruebas.comprobar((select count(*) from public.colab_listar('AAAAAAAAAAAAAAAAAAAAAA')) = 0, 'lo reservado no se lista hasta que se confirma');
select public.colab_confirmar('AAAAAAAAAAAAAAAAAAAAAA', 'a0000000000000000000a1');
select pruebas.comprobar(
  (select array_agg(id) from public.colab_listar('AAAAAAAAAAAAAAAAAAAAAA')) = array['a0000000000000000000a1'],
  'se lista lo confirmado'
);
select pruebas.comprobar(public.colab_quitar('AAAAAAAAAAAAAAAAAAAAAA', 'a0000000000000000000a1'), 'se quita una aportación recogida');
select pruebas.comprobar(not public.colab_quitar('AAAAAAAAAAAAAAAAAAAAAA', 'a0000000000000000000a1'), 'quitarla otra vez no hace nada');

-- Una reserva a medias de hace más de una hora deja de contar.
update public.aportaciones set recibida_en = now() - interval '2 hours' where id = 'a0000000000000000000a2';
select pruebas.comprobar(
  public.colab_reservar('AAAAAAAAAAAAAAAAAAAAAA', 'a0000000000000000000a4', 100, 1, 1000, 5000) = 'ok',
  'las reservas a medias de hace más de una hora no cuentan'
);
-- (En otra sentencia: la de arriba no ve lo que borra la función que llama.)
select pruebas.comprobar(not exists (select 1 from public.aportaciones where id = 'a0000000000000000000a2'), 'y se borran al reservar');

update public.invitaciones set caduca_en = now() - interval '1 minute' where id = 'CCCCCCCCCCCCCCCCCCCCCC';
select pruebas.comprobar(public.colab_reservar('CCCCCCCCCCCCCCCCCCCCCC', 'c0000000000000000000c2', 10, 300, 1000, 5000) = 'caducada', 'un enlace caducado no admite fotos');
select pruebas.comprobar((select array_agg(id) from public.colab_caducadas(50)) = array['CCCCCCCCCCCCCCCCCCCCCC'], 'la purga encuentra los enlaces caducados');
select public.colab_borrar('AAAAAAAAAAAAAAAAAAAAAA');
select pruebas.comprobar(not exists (select 1 from public.aportaciones where invitacion_id = 'AAAAAAAAAAAAAAAAAAAAAA'), 'borrar un enlace borra sus aportaciones');
reset role;
select pruebas.comprobar((select public from storage.buckets where id = 'aportaciones') = false, 'el bucket de aportaciones es privado');
