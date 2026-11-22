import type { FechaCarta } from "./fecha";
import type { Confianza, FuenteDetectada, FuenteFecha, MotivoRevision, ResultadoFecha } from "./proponer";

/**
 * La fecha de una carta, o de una foto que aún va a serlo: la que tiene, de dónde sale y, si está
 * en blanco, por qué y qué fechas se sugieren para ponerla con un toque.
 */
export interface EstadoFecha {
  fecha: FechaCarta | null;
  fuente: FuenteFecha | null;
  confianza: Confianza | null;
  motivo?: MotivoRevision;
  sugerencias?: { fecha: FechaCarta; fuente: FuenteDetectada; motivo?: MotivoRevision }[];
}

/**
 * Con qué fecha empieza una foto: la que se ha puesto sola, si era segura; si no, en blanco, con
 * sus sugerencias y el motivo. De los metadatos solo queda el resultado.
 */
export function estadoInicial(r: ResultadoFecha): EstadoFecha {
  const { automatica, sugerencias, motivo } = r;
  return {
    fecha: automatica?.fecha ?? null,
    fuente: automatica?.fuente ?? null,
    confianza: automatica?.confianza ?? null,
    motivo: automatica ? undefined : motivo,
    sugerencias: automatica ? [] : sugerencias.map(({ fecha, fuente, motivo: m }) => ({ fecha, fuente, motivo: m })),
  };
}

/**
 * Una fecha puesta sola pasa a ser solo una sugerencia, con su motivo (por ejemplo, la de una
 * sesión de fotos de fotos). Las puestas a mano y las cartas en blanco no cambian.
 */
export function aSugerencia<T extends EstadoFecha>(e: T, motivo: MotivoRevision): T {
  const { fecha, fuente } = e;
  if (!fecha || !fuente || fuente === "manual") return e;
  return { ...e, fecha: null, fuente: null, confianza: null, motivo, sugerencias: [{ fecha, fuente, motivo }] };
}

/**
 * La fecha que pone una persona, escrita o con una sugerencia: descarta las sugerencias. Null la
 * deja en blanco (borrada o a medias): se quedan las sugerencias que hubiera, sin el motivo.
 */
export function puestaAMano<T extends EstadoFecha>(e: T, fecha: FechaCarta | null): T {
  return fecha
    ? { ...e, fecha, fuente: "manual", confianza: "alta", motivo: undefined, sugerencias: [] }
    : { ...e, fecha: null, fuente: null, confianza: null, motivo: undefined };
}
