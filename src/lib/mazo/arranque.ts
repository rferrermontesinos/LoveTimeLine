/**
 * Qué pasa al abrir el configurador: se empieza siempre en Fotos. Sin mazo guardado, se crea uno
 * con el pack que llega en la URL (`?pack=` desde la portada) o, si no vale, con el de por
 * defecto. Con un mazo guardado y otro pack en la URL, se cambia su pack (solo marca el mínimo de
 * cartas: no toca las cartas), salvo que el mazo ya esté pagado. Es puro: el componente lo aplica.
 */
import { normalizarSeleccion, packPorDefecto } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import type { Accion, SeleccionMazo } from "./reductor";
import type { Mazo } from "./tipos";

/** El pack de la URL solo vale si es uno activo del catálogo. */
export function packDeLaUrl(valor: string | null | undefined, catalogo: Catalogo): string | null {
  if (!valor) return null;
  return catalogo.packs.some((p) => p.id === valor && p.activo) ? valor : null;
}

export type Arranque =
  /** No hay mazo: se crea uno con este pack. */
  | { tipo: "crear"; packId: string }
  /** Hay mazo y la URL pide otro pack: se cambia, y el aviso permite volver al de antes. */
  | { tipo: "cambiarPack"; de: string; a: string }
  /** El mazo ya está pagado: conserva su pack aunque la URL pida otro. */
  | { tipo: "mantenerPack"; pedido: string }
  | { tipo: "nada" };

export function decidirArranque(
  mazo: Pick<Mazo, "packId" | "pedido"> | null,
  packUrl: string | null | undefined,
  catalogo: Catalogo,
): Arranque {
  const pedido = packDeLaUrl(packUrl, catalogo);
  if (!mazo) {
    const packId = pedido ?? packPorDefecto(catalogo)?.id;
    return packId ? { tipo: "crear", packId } : { tipo: "nada" };
  }
  // El pack que de verdad tiene el mazo (un borrador antiguo puede traer uno retirado).
  const actual = normalizarSeleccion({ packId: mazo.packId, extras: [], mecanicas: [] }, catalogo).packId;
  if (!pedido || pedido === actual) return { tipo: "nada" };
  if (mazo.pedido?.estado === "pagado") return { tipo: "mantenerPack", pedido };
  return { tipo: "cambiarPack", de: actual, a: pedido };
}

/**
 * Acción para crear el mazo nuevo con lo que trae el catálogo por defecto: las mecánicas activas
 * marcadas como «por defecto». La paleta y el estilo los pone el reductor; el id y la hora llegan
 * de fuera para que esto siga siendo puro.
 */
export function accionCrearMazo(e: {
  id: string;
  ahora: number;
  packId: string;
  idiomaMazo: string;
  titulo: string;
  catalogo: Pick<Catalogo, "mecanicas">;
}): Extract<Accion, { tipo: "crear" }> {
  const mecanicas = e.catalogo.mecanicas.filter((m) => m.activo && m.porDefecto).sort((a, b) => a.orden - b.orden).map((m) => m.id);
  return { tipo: "crear", id: e.id, ahora: e.ahora, packId: e.packId, idiomaMazo: e.idiomaMazo, mecanicas, titulo: e.titulo };
}

/**
 * La URL (ruta, consulta y ancla) sin los parámetros indicados, conservando el resto. Null si no
 * lleva ninguno: no hay nada que cambiar.
 */
export function urlSinParametros(href: string, claves: readonly string[]): string | null {
  const url = new URL(href);
  if (!claves.some((k) => url.searchParams.has(k))) return null;
  for (const k of claves) url.searchParams.delete(k);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** La URL sin `?pack=`, conservando el resto de la consulta y el ancla. Null si no lo lleva. */
export function urlSinPack(href: string): string | null {
  return urlSinParametros(href, ["pack"]);
}

/**
 * Acción para ajustar pack, extras y mecánicas del mazo a lo que ofrece hoy el catálogo (un extra o
 * una mecánica retirados, un pack que ya no se vende), o null si no hay nada que cambiar. Lleva la
 * selección de la que parte: si el mazo cambia antes de aplicarla (el arranque le cambia el pack en
 * el mismo instante), el reductor la descarta y se vuelve a calcular con el mazo nuevo.
 */
export function accionNormalizar(mazo: SeleccionMazo, catalogo: Catalogo): Extract<Accion, { tipo: "normalizarSeleccion" }> | null {
  const s = normalizarSeleccion({ packId: mazo.packId, extras: mazo.extras, mecanicas: mazo.mecanicas }, catalogo);
  if (!s.cambiado) return null;
  return {
    tipo: "normalizarSeleccion",
    packId: s.packId,
    extras: s.extras,
    mecanicas: s.mecanicas,
    desde: { packId: mazo.packId, extras: mazo.extras, mecanicas: mazo.mecanicas },
  };
}
