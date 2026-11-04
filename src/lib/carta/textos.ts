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
    enBlancoFecha: m.enBlancoFecha,
    reto: m.reto,
    portadaReverso: m.portadaReverso,
    dedicatoriaPorDefecto: m.dedicatoriaPorDefecto,
    cajaTexto: m.cajaTexto,
    marca: BRAND_NAME,
  };
}

/** Textos de las 12 cartas del pack de retos en el idioma del mazo. */
export function textosRetos(idiomaMazo: string): string[] {
  const r = mensajesDe(idiomaMazo).retos as Record<string, string>;
  return Object.keys(r)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => r[k]!);
}

/** «43 recuerdos» en el idioma del mazo, sin depender de next-intl. */
export function textoRecuerdos(n: number, idiomaMazo: string): string {
  const base = idiomaMazo.split("-")[0];
  if (base === "en") return `${n} ${n === 1 ? "memory" : "memories"}`;
  return `${n} ${n === 1 ? "recuerdo" : "recuerdos"}`;
}

export const IDIOMAS_MAZO = ["es", "en"] as const;

/** Textos del folleto de instrucciones en el idioma del mazo (independiente del de la interfaz). */
export function textosFolleto(idiomaMazo: string) {
  const m = mensajesDe(idiomaMazo);
  return { juego: m.juego, modos: m.modos, instrucciones: m.instrucciones, pregunta: m.carta.pregunta, marca: BRAND_NAME };
}
export type TextosFolleto = ReturnType<typeof textosFolleto>;
