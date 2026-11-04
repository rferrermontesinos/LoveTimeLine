import type { TextosCarta } from "./tipos";
import { BRAND_NAME } from "@config/brand";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

const MENSAJES: Record<string, typeof es> = { es, en };

/** Textos impresos en las cartas en el idioma del mazo (independiente del de la interfaz). */
export function textosCarta(idiomaMazo: string): TextosCarta {
  const m = (MENSAJES[idiomaMazo] ?? es).carta;
  return {
    pregunta: m.pregunta,
    comodin: m.comodin,
    comodinRegla: m.comodinRegla,
    enBlancoFoto: m.enBlancoFoto,
    enBlancoFrase: m.enBlancoFrase,
    enBlancoFecha: m.enBlancoFecha,
    reto: m.reto,
    portadaReverso: m.portadaReverso,
    marca: BRAND_NAME,
  };
}

/** Textos de las 12 cartas del pack de retos en el idioma del mazo. */
export function textosRetos(idiomaMazo: string): string[] {
  const r = (MENSAJES[idiomaMazo] ?? es).retos as Record<string, string>;
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
