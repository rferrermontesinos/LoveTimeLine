-- Generado con `pnpm db:seed` a partir de supabase/catalogo.json. No lo edites a mano.
-- Importes en céntimos. Los textos van por idioma en jsonb: {"es": "…", "en": "…"}.
begin;

insert into public.ajustes_catalogo (id, version, moneda, bloque_cartas, precio_bloque_cents, max_cartas_foto, capacidad_caja, precio_caja_extra_cents) values
  (1, 1, 'EUR', 10, 600, 300, 120, 500)
on conflict (id) do update set version = excluded.version, moneda = excluded.moneda, bloque_cartas = excluded.bloque_cartas, precio_bloque_cents = excluded.precio_bloque_cents, max_cartas_foto = excluded.max_cartas_foto, capacidad_caja = excluded.capacidad_caja, precio_caja_extra_cents = excluded.precio_caja_extra_cents;

insert into public.paises (codigo, activo, moneda, envio_incluido, dias_min, dias_max) values
  ('ES', true, 'EUR', true, 5, 8)
on conflict (codigo) do update set activo = excluded.activo, moneda = excluded.moneda, envio_incluido = excluded.envio_incluido, dias_min = excluded.dias_min, dias_max = excluded.dias_max;

insert into public.packs (id, orden, activo, cartas, precio_cents, moneda, estilo_por_defecto, nombre, descripcion) values
  ('pareja', 1, true, 40, 4900, 'EUR', 'pareja', '{"es":"Pareja","en":"Couple"}'::jsonb, '{"es":"40 recuerdos de vuestra historia para jugar a dos o con amigos.","en":"40 memories of your story to play as a couple or with friends."}'::jsonb),
  ('familia', 2, true, 60, 5900, 'EUR', 'familia', '{"es":"Familia","en":"Family"}'::jsonb, '{"es":"60 recuerdos de varias generaciones para jugar en la sobremesa.","en":"60 memories across generations to play after a family meal."}'::jsonb)
on conflict (id) do update set orden = excluded.orden, activo = excluded.activo, cartas = excluded.cartas, precio_cents = excluded.precio_cents, moneda = excluded.moneda, estilo_por_defecto = excluded.estilo_por_defecto, nombre = excluded.nombre, descripcion = excluded.descripcion;

insert into public.extras (id, orden, activo, precio_tipo, precio_cents, porcentaje, cartas_fisicas, nombre, descripcion) values
  ('copia-extra', 1, true, 'porcentajeMazo', null, 60, null, '{"es":"Segunda copia del mazo","en":"Second copy of the deck"}'::jsonb, '{"es":"El mismo mazo otra vez, para regalar a los abuelos o a los amigos que salen en las fotos.","en":"The same deck again, for the grandparents or the friends in the photos."}'::jsonb),
  ('pack-retos', 2, true, 'fijo', 600, null, 12, '{"es":"Pack Retos: 12 cartas","en":"Challenge pack: 12 cards"}'::jsonb, '{"es":"Cartas de reto ya diseñadas («imita cómo os conocisteis», «tararea la canción de ese verano») que se mezclan con las vuestras.","en":"Ready-made challenge cards (“act out how you met”, “hum that summer''s song”) shuffled in with yours."}'::jsonb),
  ('acabado-lino', 3, true, 'fijo', 900, null, null, '{"es":"Acabado lino","en":"Linen finish"}'::jsonb, '{"es":"La textura de las barajas de casino: se barajan mejor y duran más.","en":"The texture of casino decks: they shuffle better and last longer."}'::jsonb),
  ('envoltorio-regalo', 4, true, 'fijo', 400, null, null, '{"es":"Envoltorio de regalo","en":"Gift wrapping"}'::jsonb, '{"es":"Llega envuelto y con tu dedicatoria impresa, listo para dar.","en":"Arrives wrapped with your printed dedication, ready to give."}'::jsonb),
  ('envio-urgente', 5, true, 'fijo', 600, null, null, '{"es":"Envío urgente (24–48 h tras imprimir)","en":"Express shipping (24–48 h after printing)"}'::jsonb, '{"es":"Para cuando el aniversario es la semana que viene.","en":"For when the anniversary is next week."}'::jsonb)
on conflict (id) do update set orden = excluded.orden, activo = excluded.activo, precio_tipo = excluded.precio_tipo, precio_cents = excluded.precio_cents, porcentaje = excluded.porcentaje, cartas_fisicas = excluded.cartas_fisicas, nombre = excluded.nombre, descripcion = excluded.descripcion;

insert into public.mecanicas (id, orden, activo, tipo, icono, asignacion, max_cartas, cada_n, cartas_fisicas, por_defecto, precio_cents, nombre, descripcion) values
  ('estrella', 1, true, 'icono', 'estrella', 'manual', 5, null, null, true, 0, '{"es":"Recuerdos estrella","en":"Star memories"}'::jsonb, '{"es":"Marca hasta 5 recuerdos favoritos. Llevan una estrella y quien los acierta gana una carta extra.","en":"Mark up to 5 favourite memories. They carry a star and whoever places one correctly wins an extra card."}'::jsonb),
  ('cuentalo', 2, true, 'icono', 'bocadillo', 'automatica', null, 4, null, true, 0, '{"es":"Cuéntalo","en":"Tell it"}'::jsonb, '{"es":"1 de cada 4 cartas lleva un bocadillo: quien la juega cuenta el recuerdo y, si la historia convence al grupo, se queda la carta aunque falle la fecha.","en":"1 in 4 cards carries a speech bubble: whoever plays it tells the story and, if the group is convinced, keeps the card even with the wrong date."}'::jsonb),
  ('comodin', 3, true, 'cartas', null, null, null, null, 2, true, 0, '{"es":"2 comodines","en":"2 wild cards"}'::jsonb, '{"es":"Úsalo para pedir una pista a quien hizo el mazo o para cambiar tu carta por otra.","en":"Use it to ask the deck maker for a clue or to swap your card for another."}'::jsonb),
  ('en-blanco', 4, true, 'cartas', null, null, null, null, 4, true, 0, '{"es":"4 cartas en blanco","en":"4 blank cards"}'::jsonb, '{"es":"Para escribir a mano los recuerdos nuevos que salgan jugando. El mazo crece con vosotros.","en":"To handwrite the new memories that come up while playing. The deck grows with you."}'::jsonb)
on conflict (id) do update set orden = excluded.orden, activo = excluded.activo, tipo = excluded.tipo, icono = excluded.icono, asignacion = excluded.asignacion, max_cartas = excluded.max_cartas, cada_n = excluded.cada_n, cartas_fisicas = excluded.cartas_fisicas, por_defecto = excluded.por_defecto, precio_cents = excluded.precio_cents, nombre = excluded.nombre, descripcion = excluded.descripcion;

commit;
