import { aIso, desdeIso, type FechaCarta } from "./fecha";
import type { MotivoRevision } from "./proponer";

/** Lo que hace falta de una carta para detectar una sesión de escaneo. */
export interface CartaConSugerencias {
  fecha: FechaCarta | null;
  sugerencias?: readonly { fecha: FechaCarta; motivo?: MotivoRevision }[];
}

/** Cuántas fotos con el mismo día reciente hacen sospechar una sesión de escaneo. */
export const MINIMO_SESION_ESCANEO = 5;

export interface SesionEscaneo {
  dia: FechaCarta;
  fotos: number;
}

/**
 * Muchas fotos sin fecha cuya mejor pista es el mismo día reciente: seguramente se escanearon o
 * se fotografiaron con el móvil ese día, y esa no es la fecha de los recuerdos. Devuelve el día
 * que más se repite, si llega al mínimo.
 */
export function sesionDeEscaneo(cartas: readonly CartaConSugerencias[], minimo = MINIMO_SESION_ESCANEO): SesionEscaneo | null {
  const porDia = new Map<string, number>();
  for (const c of cartas) {
    const s = c.sugerencias?.[0];
    if (c.fecha || !s || s.motivo !== "fecha-reciente" || s.fecha.dia === undefined) continue;
    const iso = aIso(s.fecha);
    porDia.set(iso, (porDia.get(iso) ?? 0) + 1);
  }
  let mejor: SesionEscaneo | null = null;
  for (const [iso, fotos] of porDia) {
    if (fotos >= minimo && (!mejor || fotos > mejor.fotos)) mejor = { dia: desdeIso(iso)!, fotos };
  }
  return mejor;
}
