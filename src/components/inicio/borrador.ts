/**
 * Lo que enseña el aviso «Continuar mi mazo» de la portada a partir del mazo guardado en este
 * dispositivo. Lógica pura (sin React ni IndexedDB) para poder probarla.
 */
import type { Mazo } from "@/lib/mazo/tipos";

export interface ResumenBorrador {
  id: string;
  /** Título del mazo; vacío si se le borró (el aviso pone entonces uno genérico). */
  titulo: string;
  /** Cartas de recuerdo, con foto o de texto. */
  cartas: number;
  /** El mazo ya tiene un pedido pagado. */
  pagado: boolean;
  actualizadoEn: number;
}

/**
 * Resumen del mazo guardado, o null si no hay nada que continuar: ni mazo, ni un mazo recién
 * abierto en el configurador sin ninguna carta y sin pedido.
 */
export function resumenBorrador(mazo: Pick<Mazo, "id" | "titulo" | "cartas" | "pedido" | "actualizadoEn"> | null): ResumenBorrador | null {
  if (!mazo) return null;
  const pagado = mazo.pedido?.estado === "pagado";
  if (mazo.cartas.length === 0 && !pagado) return null;
  return { id: mazo.id, titulo: mazo.titulo.trim(), cartas: mazo.cartas.length, pagado, actualizadoEn: mazo.actualizadoEn };
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
/** De mayor a menor: se usa la primera unidad que cabe entera al menos una vez. */
const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * DIA],
  ["month", 30 * DIA],
  ["week", 7 * DIA],
  ["day", DIA],
  ["hour", HORA],
  ["minute", MINUTO],
];

/**
 * Cuánto hace de `desde`, como lo pide `Intl.RelativeTimeFormat` (valor negativo: en el pasado),
 * redondeando hacia abajo. Null si fue hace menos de un minuto o la hora del dispositivo va por
 * detrás de la guardada.
 */
export function haceCuanto(desde: number, ahora: number): { valor: number; unidad: Intl.RelativeTimeFormatUnit } | null {
  const ms = ahora - desde;
  if (!Number.isFinite(ms) || ms < MINUTO) return null;
  const [unidad, tamano] = UNIDADES.find(([, t]) => ms >= t)!;
  return { valor: -Math.floor(ms / tamano), unidad };
}

/** «hace 2 horas», «ayer», «la semana pasada»… en el idioma de la página; `momento` si fue hace menos de un minuto. */
export function tiempoRelativo(desde: number, ahora: number, idioma: string, momento: string): string {
  const r = haceCuanto(desde, ahora);
  if (!r) return momento;
  return new Intl.RelativeTimeFormat(idioma, { numeric: "auto" }).format(r.valor, r.unidad);
}

/** Marca con la que se recuerda, durante la sesión, que se cerró el aviso de esta versión del mazo. */
export function marcaCierre(r: Pick<ResumenBorrador, "id" | "actualizadoEn">): string {
  return `${r.id}:${r.actualizadoEn}`;
}
