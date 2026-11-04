import type { TextosCarta } from "./tipos";
import { BRAND_NAME } from "@config/brand";
import { mensajesDe } from "../../../messages";

/** Textos impresos en las cartas en el idioma del mazo (independiente del de la interfaz). */
export function textosCarta(idiomaMazo: string): TextosCarta {
  const m = mensajesDe(idiomaMazo).carta;
  return {
    pregunta: m.pregunta,
    comodin: m.comodin,
    comodinRegla: m.comodinRegla,
    enBlancoFoto: m.enBlancoFoto,
    enBlancoFrase: m.enBlancoFrase,
    enBlancoAnio: m.enBlancoAnio,
    enBlancoDiaMes: m.enBlancoDiaMes,
    portadaReverso: m.portadaReverso,
    dedicatoriaPorDefecto: m.dedicatoriaPorDefecto,
    cajaTexto: m.cajaTexto,
    cajaLema: m.cajaLema,
    marca: BRAND_NAME,
  };
}

/** «43 recuerdos» en el idioma del mazo, sin depender de next-intl. */
export function textoRecuerdos(n: number, idiomaMazo: string): string {
  const base = idiomaMazo.split("-")[0];
  if (base === "en") return `${n} ${n === 1 ? "memory" : "memories"}`;
  return `${n} ${n === 1 ? "recuerdo" : "recuerdos"}`;
}

export const IDIOMAS_MAZO = ["es", "en"] as const;

/**
 * «Español», «Inglés»…: el nombre de un idioma escrito en el idioma de la interfaz (`locale`).
 * Como el texto está en el idioma de la página, no lleva `lang` propio. Con un código que no
 * es válido (o sin `Intl.DisplayNames`), el código en mayúsculas.
 */
export function nombreDeIdioma(codigo: string, locale: string): string {
  try {
    const n = new Intl.DisplayNames([locale], { type: "language" }).of(codigo) ?? codigo;
    return n.charAt(0).toLocaleUpperCase(locale) + n.slice(1);
  } catch {
    return codigo.toUpperCase();
  }
}

/** Textos del folleto de instrucciones en el idioma del mazo (independiente del de la interfaz). */
export function textosFolleto(idiomaMazo: string) {
  const m = mensajesDe(idiomaMazo);
  return { juego: m.juego, modos: m.modos, instrucciones: m.instrucciones, pregunta: m.carta.pregunta, marca: BRAND_NAME };
}
export type TextosFolleto = ReturnType<typeof textosFolleto>;
