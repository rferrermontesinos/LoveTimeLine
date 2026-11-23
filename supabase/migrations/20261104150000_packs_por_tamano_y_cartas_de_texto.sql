-- Cambios del 4 de noviembre de 2026 (prototipo):
--
-- · Packs por tamaño (pequeño, mediano y grande), cada uno con su claim. Las cartas que pasan
--   de las del pack se cobran una a una (packs.precio_carta_extra_cents), no por bloques de 10.
-- · Los packs ya no fijan el estilo de las cartas: hay un estilo con varias paletas de color.
-- · Cartas de recuerdo sin foto (cartas.tipo = 'texto'): llevan fecha y texto, y se cobran
--   igual que una carta con foto.
-- · Extra «Caja personalizada» (extras.efecto), con una foto del mazo o una foto propia.
-- · Los pedidos guardan las cartas de texto, el pack elegido y el cobrado, y las líneas del precio.
--
-- Los packs, extras y mecánicas que se retiran no se borran: la semilla los deja con
-- activo = false para que los pedidos antiguos sigan apuntando a ellos.

-- ───────────────────────────── Catálogo ─────────────────────────────

alter table public.ajustes_catalogo
  add column max_cartas integer,
  add column oferta_max_cartas integer;
update public.ajustes_catalogo set max_cartas = max_cartas_foto, oferta_max_cartas = 10;
alter table public.ajustes_catalogo
  alter column max_cartas set not null,
  alter column oferta_max_cartas set not null,
  add constraint ajustes_catalogo_max_cartas_check check (max_cartas > 0),
  add constraint ajustes_catalogo_oferta_max_cartas_check check (oferta_max_cartas >= 0),
  drop column bloque_cartas,
  drop column precio_bloque_cents,
  drop column max_cartas_foto;
comment on table public.ajustes_catalogo is 'Fila única: máximo de cartas por mazo, aviso de ofertas y cajas.';
comment on column public.ajustes_catalogo.oferta_max_cartas is 'Cuántas cartas por debajo de un pack mayor se empieza a avisar de la oferta.';

alter table public.packs
  add column precio_carta_extra_cents integer not null default 0 check (precio_carta_extra_cents >= 0),
  add column claim jsonb not null default '{}'::jsonb,
  drop column estilo_por_defecto;
comment on column public.packs.cartas is 'Cartas de recuerdo incluidas (con foto o de texto); también el mínimo para pagar con este pack.';
comment on column public.packs.precio_carta_extra_cents is 'Precio de cada carta que pasa de las incluidas.';
comment on column public.packs.claim is 'Para quién es el pack, por idioma: {"es": "Ideal para parejas"}.';

alter table public.extras
  add column efecto text check (efecto in ('caja-personalizada'));
comment on column public.extras.efecto is 'Lo que cambia en el mazo además de cobrarse. Hoy solo la caja personalizada.';

-- ───────────────────────────── Mazos y cartas ─────────────────────────────

alter table public.mazos rename column tinta_id to paleta_id;
alter table public.mazos
  add column caja_carta_id uuid references public.cartas (id) on delete set null,
  add column caja_foto_ruta text;
comment on column public.mazos.caja_carta_id is 'Caja personalizada con la foto de una carta del mazo.';
comment on column public.mazos.caja_foto_ruta is 'Caja personalizada con una foto propia: ruta en el bucket privado fotos-originales.';

alter table public.cartas
  add column tipo text not null default 'foto' check (tipo in ('foto', 'texto')),
  alter column nombre_archivo drop not null,
  alter column hash drop not null,
  alter column ancho_original drop not null,
  alter column alto_original drop not null,
  add constraint cartas_segun_tipo check (
    (tipo = 'foto' and nombre_archivo is not null and hash is not null and ancho_original is not null and alto_original is not null)
    or (tipo = 'texto' and nombre_archivo is null and hash is null and ruta_original is null and char_length(btrim(descripcion)) > 0)
  );
comment on column public.cartas.tipo is '«foto»: carta con foto. «texto»: recuerdo sin foto, con su fecha y su texto en descripcion.';

-- ───────────────────────────── Pedidos ─────────────────────────────

alter table public.pedidos
  add column cartas_texto integer not null default 0 check (cartas_texto >= 0),
  add column pack_elegido_id text references public.packs (id),
  add column lineas jsonb not null default '[]'::jsonb,
  add column catalogo_version integer;
comment on column public.pedidos.pack_id is 'Pack cobrado: el elegido o uno mayor si con esas cartas salía más barato.';
comment on column public.pedidos.pack_elegido_id is 'Pack que eligió el cliente.';
comment on column public.pedidos.lineas is 'Líneas del precio tal como se cobraron, en céntimos.';
