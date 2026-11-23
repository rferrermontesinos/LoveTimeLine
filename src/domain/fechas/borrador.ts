import { crearFecha, esFutura, precisionDe, type FechaCarta, type Precision } from "./fecha";

/**
 * Lo que hay escrito en el selector de fecha, aunque todavía no sea una fecha: el día y el año tal
 * como se teclean y el mes elegido («» si falta). Es la lógica del selector, sin React.
 */
export interface BorradorFecha {
  precision: Precision;
  dia: string;
  mes: string;
  anio: string;
}

/** Borrador a partir de la fecha de la carta (con su precisión) o vacío. */
export function borradorDe(f: FechaCarta | null, precisionPorDefecto: Precision): BorradorFecha {
  if (!f) return { precision: precisionPorDefecto, dia: "", mes: "", anio: "" };
  return { precision: precisionDe(f), dia: f.dia ? String(f.dia) : "", mes: f.mes ? String(f.mes) : "", anio: String(f.anio) };
}

/**
 * Aplica lo que se acaba de teclear o elegir. Solo limpia (cifras; como mucho 2 en el día y 4 en el
 * año), nunca corrige: un 29 de febrero de 2019 se queda como está y se avisa de que no existe, en
 * vez de guardar sin decir nada otra fecha. Y mientras se teclea el año, «2» no es el año 2.
 */
export function cambiarBorrador(b: BorradorFecha, cambios: Partial<BorradorFecha>): BorradorFecha {
  const nuevo = { ...b, ...cambios };
  if (cambios.dia !== undefined) nuevo.dia = cambios.dia.replace(/\D/g, "").slice(0, 2);
  if (cambios.anio !== undefined) nuevo.anio = cambios.anio.replace(/\D/g, "").slice(0, 4);
  return nuevo;
}

/** La fecha del borrador, si tiene todo lo que pide su precisión y existe (aunque sea futura). */
export function fechaDelBorrador(b: BorradorFecha): FechaCarta | null {
  if (!/^\d{4}$/.test(b.anio)) return null;
  const anio = Number(b.anio);
  if (b.precision === "anio") return crearFecha(anio);
  const mes = Number(b.mes);
  if (!mes) return null;
  if (b.precision === "mes") return crearFecha(anio, mes);
  const dia = Number(b.dia);
  if (!dia) return null;
  return crearFecha(anio, mes, dia);
}

/** El borrador tiene todo lo que pide su precisión (aunque la fecha no exista). */
export function borradorCompleto(b: BorradorFecha): boolean {
  if (b.anio.length !== 4) return false;
  if (b.precision === "anio") return true;
  if (!b.mes) return false;
  return b.precision === "mes" || !!b.dia;
}

export interface EstadoBorrador {
  /** La fecha que se guarda en la carta: solo si existe y no es futura; si no, null (carta pendiente). */
  fecha: FechaCarta | null;
  /** Por qué no vale lo escrito, cuando ya está completo: no existe o es posterior a hoy. */
  error: "invalida" | "futura" | null;
  /** Hay año, pero falta el mes o el día que pide la precisión elegida. */
  aMedias: boolean;
}

export function estadoBorrador(b: BorradorFecha, hoy: Date): EstadoBorrador {
  const f = fechaDelBorrador(b);
  const error = borradorCompleto(b) && !f ? "invalida" : f && esFutura(f, hoy) ? "futura" : null;
  return {
    fecha: f && !error ? f : null,
    error,
    aMedias: !error && !f && b.anio.length === 4 && b.precision !== "anio",
  };
}
