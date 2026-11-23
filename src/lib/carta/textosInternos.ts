/**
 * Textos de las herramientas internas (folleto plegable y muestrario de cartas), en
 * messages/<idioma>/interno.json. A propósito, no están en MENSAJES (messages/index.ts): así no
 * viajan a la web pública, ni en el HTML (el proveedor de next-intl del layout manda todos los
 * mensajes a cada página) ni en el JS (las cartas de la portada importan MENSAJES para sus
 * textos). Solo los importan las páginas de /interno y sus componentes.
 */
import es from "../../../messages/es/interno.json";
import en from "../../../messages/en/interno.json";

export type TextosInternos = (typeof es)["interno"];

/** Por idioma. El inglés se comprueba contra el español: si le falta una clave, no compila. */
export const TEXTOS_INTERNOS: Record<"es" | "en", TextosInternos> = { es: es.interno, en: en.interno };

/** Textos internos en un idioma (de la interfaz o del mazo); el español si no lo hay. */
export function textosInternos(idioma: string): TextosInternos {
  return idioma.split("-")[0] === "en" ? TEXTOS_INTERNOS.en : TEXTOS_INTERNOS.es;
}
