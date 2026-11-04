/**
 * Textos de la interfaz por idioma. Cada área tiene su archivo (messages/<idioma>/<área>.json)
 * con uno o varios espacios de nombres de primer nivel; aquí se juntan en un solo objeto.
 * Para añadir un idioma: copiar la carpeta messages/es, traducirla y sumarla aquí y en
 * src/i18n/routing.ts. TypeScript exige que cada idioma tenga las mismas claves que el español.
 */
import carta from "./es/carta.json";
import cartas from "./es/cartas.json";
import comun from "./es/comun.json";
import confirmado from "./es/confirmado.json";
import crear from "./es/crear.json";
import estilo from "./es/estilo.json";
import fotos from "./es/fotos.json";
import inicio from "./es/inicio.json";
import instrucciones from "./es/instrucciones.json";
import juego from "./es/juego.json";
import pedido from "./es/pedido.json";
import cartaEn from "./en/carta.json";
import cartasEn from "./en/cartas.json";
import comunEn from "./en/comun.json";
import confirmadoEn from "./en/confirmado.json";
import crearEn from "./en/crear.json";
import estiloEn from "./en/estilo.json";
import fotosEn from "./en/fotos.json";
import inicioEn from "./en/inicio.json";
import instruccionesEn from "./en/instrucciones.json";
import juegoEn from "./en/juego.json";
import pedidoEn from "./en/pedido.json";

/** Partes de cada idioma, en el mismo orden. Un test comprueba que no repiten espacios de nombres. */
export const PARTES = {
  es: [comun, inicio, juego, confirmado, instrucciones, carta, crear, fotos, cartas, estilo, pedido],
  en: [comunEn, inicioEn, juegoEn, confirmadoEn, instruccionesEn, cartaEn, crearEn, fotosEn, cartasEn, estiloEn, pedidoEn],
} as const;

const es = { ...comun, ...inicio, ...juego, ...confirmado, ...instrucciones, ...carta, ...crear, ...fotos, ...cartas, ...estilo, ...pedido };

export type Mensajes = typeof es;

const en: Mensajes = {
  ...comunEn,
  ...inicioEn,
  ...juegoEn,
  ...confirmadoEn,
  ...instruccionesEn,
  ...cartaEn,
  ...crearEn,
  ...fotosEn,
  ...cartasEn,
  ...estiloEn,
  ...pedidoEn,
};

export const MENSAJES: Record<"es" | "en", Mensajes> = { es, en };

export function mensajesDe(idioma: string): Mensajes {
  const base = idioma.split("-")[0];
  return base === "en" ? MENSAJES.en : MENSAJES.es;
}
