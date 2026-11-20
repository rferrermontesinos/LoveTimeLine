import { aIso, fechaDeInstante, precisionDe, rangoDias, type FechaCarta } from "./fecha";
import { DIAS_PREPARACION, type MotivoRevision, type ResultadoFecha } from "./proponer";

/**
 * Cuántas fotos de cámara del mismo día reciente hacen pensar en una sesión de fotos de fotos (o
 * de escaneo): alguien fotografió con el móvil, ese día, copias antiguas para el mazo.
 */
export const MINIMO_SESION_ESCANEO = 5;
/**
 * Hasta cuántos días antes de la subida se buscan sesiones. Las fotos de los últimos
 * DIAS_PREPARACION días ya quedan en blanco solas; esto cubre a quien digitalizó semanas antes.
 */
export const DIAS_SESION_ESCANEO = 62;

/** Días (desde la fecha hasta `hoy`) de una fecha con día; null si no tiene día. */
function diasHasta(f: FechaCarta, hoy: Date): number | null {
  if (precisionDe(f) !== "dia") return null;
  return rangoDias(fechaDeInstante(hoy))[0] - rangoDias(f)[0];
}

/**
 * Día (ISO) de una fecha de cámara puesta sola que, repetido en muchas fotos de la misma subida,
 * sería una sesión de fotos de fotos. Null si la fecha no es de cámara o no es de las últimas semanas.
 */
export function diaDeSesion(r: ResultadoFecha, hoy: Date): string | null {
  const a = r.automatica;
  if (!a || (a.pista !== "camara" && a.pista !== "metadatos")) return null;
  const dias = diasHasta(a.fecha, hoy);
  return dias !== null && dias >= 0 && dias < DIAS_SESION_ESCANEO ? aIso(a.fecha) : null;
}

/**
 * Lleva la cuenta de una subida: dice qué fotos hay que dejar en blanco porque su día ha llegado
 * al mínimo de una sesión. Al llegar, devuelve también las de ese día que ya se habían añadido.
 */
export function crearDetectorSesion(hoy: Date, minimo = MINIMO_SESION_ESCANEO) {
  const porDia = new Map<string, string[]>();
  const sesiones = new Set<string>();
  return {
    /** Apunta una foto. `enBlanco`: esta foto va en blanco. `anteriores`: las que hay que pasar ahora a en blanco. */
    registrar(id: string, r: ResultadoFecha): { enBlanco: boolean; anteriores: string[] } {
      const dia = diaDeSesion(r, hoy);
      if (!dia) return { enBlanco: false, anteriores: [] };
      const ids = [...(porDia.get(dia) ?? []), id];
      porDia.set(dia, ids);
      if (sesiones.has(dia)) return { enBlanco: true, anteriores: [] };
      if (ids.length < minimo) return { enBlanco: false, anteriores: [] };
      sesiones.add(dia);
      return { enBlanco: true, anteriores: ids.slice(0, -1) };
    },
  };
}

/** Lo que hace falta de una carta guardada para mejorar sus fechas con las reglas actuales. */
export interface CartaConSugerencias {
  id: string;
  fecha: FechaCarta | null;
  motivo?: MotivoRevision;
  sugerencias?: readonly { fecha: FechaCarta; motivo?: MotivoRevision }[];
  anadidaEn: number;
}

/**
 * En un mazo guardado con las reglas anteriores, las cartas sin fecha cuya mejor sugerencia es una
 * fecha «reciente» del mismo día, repetida en MINIMO_SESION_ESCANEO cartas o más, de las semanas
 * antes de añadirlas: una sesión de fotos de fotos. Esas siguen en blanco.
 */
export function idsEnSesionGuardada(cartas: readonly CartaConSugerencias[], minimo = MINIMO_SESION_ESCANEO): Set<string> {
  const porDia = new Map<string, string[]>();
  for (const c of cartas) {
    const s = c.sugerencias?.[0];
    if (c.fecha || !s || (s.motivo ?? c.motivo) !== "fecha-reciente") continue;
    const dias = diasHasta(s.fecha, new Date(c.anadidaEn));
    if (dias === null || dias < DIAS_PREPARACION || dias >= DIAS_SESION_ESCANEO) continue;
    const iso = aIso(s.fecha);
    porDia.set(iso, [...(porDia.get(iso) ?? []), c.id]);
  }
  return new Set([...porDia.values()].filter((ids) => ids.length >= minimo).flat());
}
