/**
 * Los avisos de oferta como texto. `cotizar` ya calcula las ofertas con el catálogo; aquí solo se
 * elige cuál enseñar y con qué frase (una clave de `crear.ofertas` y sus valores, ya formateados
 * en el idioma de la interfaz). Las frases dicen siempre lo que se paga de verdad: si subir de
 * pack cuesta algo más, se dice cuánto, y el ahorro es frente a sumar esas cartas sueltas.
 */
import { formatearImporte, type Oferta } from "@/domain/precios/cotizar";
import { textoEn } from "@/domain/precios/tipos";

export type ClaveOferta =
  | "subir"
  | "subirDetalle"
  | "subirMenos"
  | "subirIgual"
  | "packAplicado"
  | "packAplicadoDetalle"
  | "packAplicadoHuecos"
  | "packAplicadoHuecosDetalle"
  | "bajar";

export interface TextoOferta {
  clave: ClaveOferta;
  valores: Record<string, string | number>;
}

/**
 * La oferta de la barra inferior, si hay alguna: primero la que pide hacer algo (con unas cartas
 * más se sube de pack; o, si faltan cartas, un pack menor ya está cubierto) y si no, la buena
 * noticia de que ya se aplica un pack mayor.
 */
export function ofertaPrincipal(ofertas: readonly Oferta[]): Oferta | null {
  return ofertas.find((o) => o.tipo === "subir") ?? ofertas.find((o) => o.tipo === "bajar") ?? ofertas.find((o) => o.tipo === "pack-aplicado") ?? null;
}

/**
 * Frase de una oferta. `detalle` es la versión larga (el bloque de Pedido): la de subir de pack
 * explica también el ahorro frente a sumar las cartas sueltas.
 */
export function textoOferta(o: Oferta, moneda: string, idioma: string, detalle = false): TextoOferta {
  const dinero = (cents: number) => formatearImporte(cents, moneda, idioma);
  const pack = textoEn(o.pack.nombre, idioma);
  switch (o.tipo) {
    case "subir": {
      const n = o.cartasMas;
      if (o.diferenciaCents < 0) return { clave: "subirMenos", valores: { n, pack, menos: dinero(-o.diferenciaCents) } };
      if (o.diferenciaCents === 0) return { clave: "subirIgual", valores: { n, pack } };
      return { clave: detalle ? "subirDetalle" : "subir", valores: { n, pack, diferencia: dinero(o.diferenciaCents), ahorro: dinero(o.ahorroCents) } };
    }
    case "pack-aplicado":
      if (o.huecos > 0) {
        return { clave: detalle ? "packAplicadoHuecosDetalle" : "packAplicadoHuecos", valores: { pack, ahorro: dinero(o.ahorroCents), huecos: o.huecos } };
      }
      return { clave: detalle ? "packAplicadoDetalle" : "packAplicado", valores: { pack, ahorro: dinero(o.ahorroCents) } };
    case "bajar":
      return { clave: "bajar", valores: { pack, total: dinero(o.totalCents) } };
  }
}
