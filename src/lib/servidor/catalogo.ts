/**
 * Catálogo (packs, ampliaciones, extras y mecánicas). Fuente de verdad: la base de datos.
 * Sin Supabase configurado (modo demostración) se usa la semilla supabase/catalogo.json,
 * que es exactamente lo que carga supabase/seed.sql.
 */
import semilla from "../../../supabase/catalogo.json";
import type { Catalogo } from "@/domain/precios/tipos";
import { clienteSupabaseServidor, supabaseConfigurado } from "./supabase";

const CATALOGO_SEMILLA = semilla as unknown as Catalogo;

export async function obtenerCatalogo(): Promise<Catalogo> {
  if (!supabaseConfigurado()) return CATALOGO_SEMILLA;
  try {
    const sb = clienteSupabaseServidor();
    const [packs, extras, mecanicas, ajustes, paises] = await Promise.all([
      sb.from("packs").select("*").eq("activo", true).order("orden"),
      sb.from("extras").select("*").eq("activo", true).order("orden"),
      sb.from("mecanicas").select("*").eq("activo", true).order("orden"),
      sb.from("ajustes_catalogo").select("*").eq("id", 1).maybeSingle(),
      sb.from("paises").select("*").order("codigo"),
    ]);
    if (packs.error || extras.error || mecanicas.error || ajustes.error || paises.error || !ajustes.data) throw new Error("catálogo incompleto");
    const a = ajustes.data as Record<string, number | string>;
    return {
      version: Number(a.version ?? 1),
      moneda: String(a.moneda ?? "EUR"),
      paises: paises.data.length
        ? paises.data.map((p) => ({
            codigo: p.codigo,
            activo: p.activo,
            moneda: p.moneda,
            envioIncluido: p.envio_incluido,
            diasEntrega: { min: p.dias_min, max: p.dias_max },
          }))
        : CATALOGO_SEMILLA.paises,
      packs: packs.data.map((p) => ({
        id: p.id,
        orden: p.orden,
        activo: p.activo,
        cartas: p.cartas,
        precioCents: p.precio_cents,
        moneda: p.moneda,
        estiloPorDefecto: p.estilo_por_defecto,
        nombre: p.nombre,
        descripcion: p.descripcion,
      })),
      ampliacion: {
        bloqueCartas: Number(a.bloque_cartas),
        precioBloqueCents: Number(a.precio_bloque_cents),
        maxCartasFoto: Number(a.max_cartas_foto),
      },
      caja: { capacidadCartas: Number(a.capacidad_caja), precioCajaExtraCents: Number(a.precio_caja_extra_cents) },
      extras: extras.data.map((x) => ({
        id: x.id,
        orden: x.orden,
        activo: x.activo,
        precio: x.precio_tipo === "fijo" ? { tipo: "fijo", cents: x.precio_cents } : { tipo: "porcentajeMazo", porcentaje: x.porcentaje },
        cartasFisicas: x.cartas_fisicas ?? undefined,
        nombre: x.nombre,
        descripcion: x.descripcion,
      })),
      mecanicas: mecanicas.data.map((m) => ({
        id: m.id,
        orden: m.orden,
        activo: m.activo,
        tipo: m.tipo,
        icono: m.icono ?? undefined,
        asignacion: m.asignacion ?? undefined,
        maxCartas: m.max_cartas ?? undefined,
        cadaN: m.cada_n ?? undefined,
        cartasFisicas: m.cartas_fisicas ?? undefined,
        porDefecto: m.por_defecto,
        precioCents: m.precio_cents,
        nombre: m.nombre,
        descripcion: m.descripcion,
      })),
    };
  } catch (e) {
    console.error("No se pudo leer el catálogo de Supabase; uso la semilla", e);
    return CATALOGO_SEMILLA;
  }
}
