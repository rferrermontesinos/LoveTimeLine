/**
 * Fecha de una carta con su precisión: solo año, mes y año, o fecha completa.
 * Por dentro se guarda en ISO recortado a la precisión: "2019", "2019-08" o "2019-08-14".
 */
export type Precision = "anio" | "mes" | "dia";

export interface FechaCarta {
  anio: number;
  /** 1–12 */
  mes?: number;
  /** 1–31, solo si hay mes */
  dia?: number;
}

export const ANIO_MINIMO = 1850;

const MS_DIA = 86_400_000;

export function precisionDe(f: FechaCarta): Precision {
  if (f.mes === undefined) return "anio";
  if (f.dia === undefined) return "mes";
  return "dia";
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function esFechaValida(f: FechaCarta): boolean {
  if (!Number.isInteger(f.anio) || f.anio < ANIO_MINIMO || f.anio > 9999) return false;
  if (f.mes === undefined) return f.dia === undefined;
  if (!Number.isInteger(f.mes) || f.mes < 1 || f.mes > 12) return false;
  if (f.dia === undefined) return true;
  return Number.isInteger(f.dia) && f.dia >= 1 && f.dia <= diasDelMes(f.anio, f.mes);
}

/** Crea una fecha validada; devuelve null si no existe (por ejemplo, 30 de febrero). */
export function crearFecha(anio: number, mes?: number, dia?: number): FechaCarta | null {
  const f: FechaCarta = { anio };
  if (mes !== undefined) f.mes = mes;
  if (mes !== undefined && dia !== undefined) f.dia = dia;
  return esFechaValida(f) ? f : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function aIso(f: FechaCarta): string {
  if (f.mes === undefined) return String(f.anio);
  if (f.dia === undefined) return `${f.anio}-${pad(f.mes)}`;
  return `${f.anio}-${pad(f.mes)}-${pad(f.dia)}`;
}

export function desdeIso(iso: string): FechaCarta | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(iso.trim());
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = m[2] !== undefined ? Number(m[2]) : undefined;
  const dia = m[3] !== undefined ? Number(m[3]) : undefined;
  return crearFecha(anio, mes, dia);
}

/** Primer y último día (en días desde 1970, UTC) que cubre la fecha según su precisión. */
export function rangoDias(f: FechaCarta): [number, number] {
  if (f.mes === undefined) {
    return [Date.UTC(f.anio, 0, 1) / MS_DIA, Date.UTC(f.anio, 11, 31) / MS_DIA];
  }
  if (f.dia === undefined) {
    return [Date.UTC(f.anio, f.mes - 1, 1) / MS_DIA, Date.UTC(f.anio, f.mes - 1, diasDelMes(f.anio, f.mes)) / MS_DIA];
  }
  const d = Date.UTC(f.anio, f.mes - 1, f.dia) / MS_DIA;
  return [d, d];
}

/**
 * Orden de la línea temporal: por el primer día que cubre la fecha y, a igualdad,
 * la más precisa primero ("2019" va después de "2019-01-01").
 */
export function compararFechas(a: FechaCarta, b: FechaCarta): number {
  const [ia, fa] = rangoDias(a);
  const [ib, fb] = rangoDias(b);
  if (ia !== ib) return ia - ib;
  return fa - fb;
}

/**
 * Regla de colocación propuesta para el juego: una carta puede ir antes que otra
 * si alguna fecha real de su rango puede ser anterior o igual. Así, una carta con
 * solo el año vale en cualquier punto de ese año.
 */
export function puedeIrAntes(a: FechaCarta, b: FechaCarta): boolean {
  return rangoDias(a)[0] <= rangoDias(b)[1];
}

/** Comprueba si una fila de cartas está bien ordenada según la regla anterior. */
export function filaBienOrdenada(fechas: FechaCarta[]): boolean {
  for (let i = 0; i < fechas.length; i++) {
    for (let j = i + 1; j < fechas.length; j++) {
      if (!puedeIrAntes(fechas[i]!, fechas[j]!)) return false;
    }
  }
  return true;
}

export function mismaFecha(a: FechaCarta, b: FechaCarta): boolean {
  return aIso(a) === aIso(b);
}

/** Recorta una fecha a una precisión menor (o igual). Nunca inventa mes ni día. */
export function conPrecision(f: FechaCarta, p: Precision): FechaCarta {
  if (p === "anio") return { anio: f.anio };
  if (p === "mes") return f.mes === undefined ? { anio: f.anio } : { anio: f.anio, mes: f.mes };
  return { ...f };
}

/** Fecha de calendario (sin hora) de un instante, en la zona horaria del navegador o UTC. */
export function fechaDeInstante(instante: Date, zona: "local" | "utc" = "local"): FechaCarta {
  if (zona === "utc") {
    return { anio: instante.getUTCFullYear(), mes: instante.getUTCMonth() + 1, dia: instante.getUTCDate() };
  }
  return { anio: instante.getFullYear(), mes: instante.getMonth() + 1, dia: instante.getDate() };
}

/** Cierto si la fecha empieza después de hoy. */
export function esFutura(f: FechaCarta, hoy: Date): boolean {
  const h = fechaDeInstante(hoy);
  return rangoDias(f)[0] > rangoDias(h)[0];
}

export function diferenciaDias(a: FechaCarta, b: FechaCarta): number {
  return Math.abs(rangoDias(a)[0] - rangoDias(b)[0]);
}
