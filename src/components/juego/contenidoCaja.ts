/**
 * «Qué trae la caja», en «Cómo se juega»: las cartas especiales (comodines y cartas en blanco) y
 * cuántas, sacadas del catálogo (`mecanicas[].cartasFisicas`) para que la página no diga
 * cantidades escritas a mano que dejen de ser verdad si cambia el catálogo. Lógica pura.
 */
import type { Mecanica } from "@/domain/precios/tipos";

/** Mecánicas que añaden cartas a la caja, en el orden en que se nombran, y su texto en `juego.contenidoCaja`. */
export const CARTAS_ESPECIALES = [
  { id: "comodin", clave: "comodines" },
  { id: "en-blanco", clave: "enBlanco" },
] as const;

export type ClaveCartaEspecial = (typeof CARTAS_ESPECIALES)[number]["clave"];
export type ClaveContenidoCaja = ClaveCartaEspecial | "conEspeciales" | "sinEspeciales";

/** Traduce una clave de `juego.contenidoCaja` (el `t` de next-intl con ese espacio de nombres). */
export type TraducirCaja = (clave: ClaveContenidoCaja, valores?: Record<string, string | number>) => string;

/**
 * Las cartas especiales que trae la caja: las de las mecánicas activas del catálogo que añaden
 * alguna carta. Una mecánica retirada o sin cartas no sale.
 */
export function cartasEspeciales(mecanicas: readonly Pick<Mecanica, "id" | "activo" | "cartasFisicas">[]): { clave: ClaveCartaEspecial; n: number }[] {
  return CARTAS_ESPECIALES.flatMap(({ id, clave }) => {
    const m = mecanicas.find((x) => x.id === id);
    const n = m?.activo ? (m.cartasFisicas ?? 0) : 0;
    return n > 0 ? [{ clave, n }] : [];
  });
}

/** La frase entera: «…y las cartas especiales que elijáis: 2 comodines y 4 cartas en blanco…», en el idioma de la página. */
export function textoContenidoCaja(mecanicas: readonly Pick<Mecanica, "id" | "activo" | "cartasFisicas">[], idioma: string, t: TraducirCaja): string {
  const especiales = cartasEspeciales(mecanicas).map((e) => t(e.clave, { n: e.n }));
  if (especiales.length === 0) return t("sinEspeciales");
  return t("conEspeciales", { especiales: new Intl.ListFormat(idioma, { type: "conjunction" }).format(especiales) });
}
