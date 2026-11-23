/**
 * Convierte el catálogo semilla (supabase/catalogo.json) en el SQL de supabase/seed.sql.
 * Es puro y determinista: un test comprueba que seed.sql está al día con el JSON.
 * Usa «upsert», así que volver a cargarlo actualiza precios y textos sin duplicar nada.
 */
import type { Catalogo } from "@/domain/precios/tipos";

type Fila = Record<string, string>;

const texto = (v: string) => `'${v.replace(/'/g, "''")}'`;
const jsonb = (v: unknown) => `${texto(JSON.stringify(v))}::jsonb`;
const entero = (v: number | undefined | null) => (v === undefined || v === null ? "null" : String(Math.trunc(v)));
const logico = (v: boolean) => (v ? "true" : "false");

function upsert(tabla: string, clave: string, filas: Fila[]): string {
  if (filas.length === 0) return "";
  const columnas = Object.keys(filas[0]!);
  const valores = filas.map((f) => `  (${columnas.map((c) => f[c]).join(", ")})`).join(",\n");
  const cambios = columnas
    .filter((c) => c !== clave)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return `insert into public.${tabla} (${columnas.join(", ")}) values\n${valores}\non conflict (${clave}) do update set ${cambios};\n`;
}

export function semillaSql(c: Catalogo): string {
  const sentencias = [
    upsert("ajustes_catalogo", "id", [
      {
        id: "1",
        version: entero(c.version),
        moneda: texto(c.moneda),
        max_cartas: entero(c.ampliacion.maxCartas),
        oferta_max_cartas: entero(c.ampliacion.ofertaMaxCartas),
        capacidad_caja: entero(c.caja.capacidadCartas),
        precio_caja_extra_cents: entero(c.caja.precioCajaExtraCents),
      },
    ]),
    upsert(
      "paises",
      "codigo",
      c.paises.map((p) => ({
        codigo: texto(p.codigo),
        activo: logico(p.activo),
        moneda: texto(p.moneda),
        envio_incluido: logico(p.envioIncluido),
        dias_min: entero(p.diasEntrega.min),
        dias_max: entero(p.diasEntrega.max),
      })),
    ),
    upsert(
      "packs",
      "id",
      c.packs.map((p) => ({
        id: texto(p.id),
        orden: entero(p.orden),
        activo: logico(p.activo),
        cartas: entero(p.cartas),
        precio_cents: entero(p.precioCents),
        precio_carta_extra_cents: entero(p.precioCartaExtraCents),
        moneda: texto(p.moneda),
        nombre: jsonb(p.nombre),
        claim: jsonb(p.claim),
        descripcion: jsonb(p.descripcion),
      })),
    ),
    upsert(
      "extras",
      "id",
      c.extras.map((x) => ({
        id: texto(x.id),
        orden: entero(x.orden),
        activo: logico(x.activo),
        precio_tipo: texto(x.precio.tipo),
        precio_cents: x.precio.tipo === "fijo" ? entero(x.precio.cents) : "null",
        porcentaje: x.precio.tipo === "porcentajeMazo" ? entero(x.precio.porcentaje) : "null",
        cartas_fisicas: entero(x.cartasFisicas),
        efecto: x.efecto ? texto(x.efecto) : "null",
        nombre: jsonb(x.nombre),
        descripcion: jsonb(x.descripcion),
      })),
    ),
    upsert(
      "mecanicas",
      "id",
      c.mecanicas.map((m) => ({
        id: texto(m.id),
        orden: entero(m.orden),
        activo: logico(m.activo),
        tipo: texto(m.tipo),
        icono: m.icono ? texto(m.icono) : "null",
        asignacion: m.asignacion ? texto(m.asignacion) : "null",
        max_cartas: entero(m.maxCartas),
        cada_n: entero(m.cadaN),
        cartas_fisicas: entero(m.cartasFisicas),
        por_defecto: logico(m.porDefecto),
        precio_cents: entero(m.precioCents),
        nombre: jsonb(m.nombre),
        descripcion: jsonb(m.descripcion),
      })),
    ),
  ].filter(Boolean);
  return [
    "-- Generado con `pnpm db:seed` a partir de supabase/catalogo.json. No lo edites a mano.",
    "-- Importes en céntimos. Los textos van por idioma en jsonb: {\"es\": \"…\", \"en\": \"…\"}.",
    "begin;",
    "",
    ...sentencias,
    "commit;",
    "",
  ].join("\n");
}
