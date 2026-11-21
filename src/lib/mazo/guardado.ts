/**
 * Guardado del mazo en este dispositivo, sin registrarse: qué versión hay guardada, qué hacer si
 * otra pestaña la ha cambiado y cómo contar cuándo se guardó. Lógica pura (sin IndexedDB ni
 * React): la aplica ProveedorMazo (contexto.tsx).
 *
 * Cada pestaña recuerda la última versión que leyó o escribió (su «base»). Solo escribe si la
 * guardada sigue siendo esa; si no, otra pestaña se le ha adelantado y, en vez de pisarla, avisa.
 */
import type { Accion } from "./reductor";
import { esFoto, type Mazo } from "./tipos";

/** Lo que identifica una versión guardada del mazo: cuál es y cuándo cambió por última vez. */
export interface VersionMazo {
  id: string;
  actualizadoEn: number;
}

/** La versión de un mazo guardado (de cualquier formato), o null si no hay o no se reconoce. */
export function versionDe(valor: unknown): VersionMazo | null {
  if (!valor || typeof valor !== "object") return null;
  const { id, actualizadoEn } = valor as Record<string, unknown>;
  return typeof id === "string" && typeof actualizadoEn === "number" ? { id, actualizadoEn } : null;
}

/** Dos versiones iguales; dos «sin mazo» también lo son. */
export function mismaVersion(a: VersionMazo | null, b: VersionMazo | null): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id && a.actualizadoEn === b.actualizadoEn;
}

/**
 * Cambios que se guardan sin esperar al guardado automático: los que apuntan a fotos ya escritas
 * en el almacén (cartas importadas, la foto propia de la caja). Si el navegador se cierra de golpe
 * en mitad de una importación, el mazo guardado ya tiene las cartas de las fotos leídas.
 */
export function guardarSinEsperar(a: Accion): boolean {
  if (a.tipo === "anadirCartas") return a.cartas.some(esFoto);
  return a.tipo === "ponerCaja" && a.caja?.origen === "propia";
}

/** Un mazo recién empezado, sin nada que se pueda perder: ni cartas, ni permiso de fotos, ni pedido. */
export function sinNadaQuePerder(m: Pick<Mazo, "cartas" | "consentimientoFotos" | "pedido">): boolean {
  return m.cartas.length === 0 && m.consentimientoFotos === null && m.pedido === null;
}

/**
 * Al traer lo que otra pestaña ha guardado, esta conserva por dónde va (paso y carta abierta) si
 * es el mismo mazo: así dos pestañas abiertas a la vez no se mueven la una a la otra.
 */
export function conVistaDeEstaPestana(guardado: Mazo, actual: Pick<Mazo, "id" | "paso" | "cartaAbierta"> | null): Mazo {
  if (!actual || actual.id !== guardado.id) return guardado;
  if (guardado.paso === actual.paso && (guardado.cartaAbierta ?? null) === (actual.cartaAbierta ?? null)) return guardado;
  return { ...guardado, paso: actual.paso, cartaAbierta: actual.cartaAbierta };
}

export type Sincronizacion =
  /** Lo guardado es lo que esta pestaña ya tiene (o se ha borrado y aún no hay otro): nada que hacer. */
  | "nada"
  /** Otra pestaña ha guardado algo más nuevo y esta no tiene cambios propios: se trae lo guardado. */
  | "recargar"
  /** Las dos han cambiado el mazo: esta deja de guardar y pide qué hacer. */
  | "conflicto";

/**
 * Qué hacer cuando otra pestaña avisa de que ha guardado, o al volver a esta pestaña.
 * `guardado` es lo que hay ahora en el almacén; `base`, lo último que esta pestaña leyó o escribió;
 * `cambiosSinGuardar`, si esta pestaña tiene cambios que aún no ha escrito.
 */
export function decidirSincronizacion(e: { guardado: VersionMazo | null; base: VersionMazo | null; cambiosSinGuardar: boolean }): Sincronizacion {
  if (mismaVersion(e.guardado, e.base)) return "nada";
  // Borrado en otra pestaña («Empezar otro mazo»): el mazo nuevo llega enseguida con su aviso.
  if (!e.guardado) return e.cambiosSinGuardar ? "conflicto" : "nada";
  return e.cambiosSinGuardar ? "conflicto" : "recargar";
}

/** Cómo va el guardado, para enseñarlo. */
export type EstadoGuardado =
  /** Hay cambios que aún no están en el dispositivo (el guardado automático va al poco de cada cambio). */
  | { tipo: "guardando" }
  /** Guardado en el dispositivo; `en` es cuándo (o cuándo cambió, si se acaba de abrir). */
  | { tipo: "guardado"; en: number }
  /** El navegador no deja guardar (modo privado, almacén bloqueado). */
  | { tipo: "sin-almacen" }
  /** No cabe: el dispositivo no tiene espacio para el mazo o sus fotos. */
  | { tipo: "sin-espacio" }
  | { tipo: "error" }
  /**
   * Otra pestaña ha cambiado el mazo y esta ha dejado de guardar para no pisarlo. `otroMazo`: allí
   * se empezó otro mazo (o se borró), así que lo de esta pestaña ya no se puede guardar encima.
   */
  | { tipo: "conflicto"; otroMazo: boolean };

/**
 * Pedir al navegador que no borre el almacén cuando le falte espacio tiene sentido en cuanto hay
 * algo que perder: tras el permiso de las fotos o la primera foto.
 */
export function debePedirPersistencia(m: Pick<Mazo, "consentimientoFotos" | "cartas">): boolean {
  return m.consentimientoFotos !== null || m.cartas.some((c) => c.tipo === "foto");
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
 * redondeando hacia abajo. Null si fue hace menos de un minuto o si el reloj va por detrás.
 */
export function haceCuanto(desde: number, ahora: number): { valor: number; unidad: Intl.RelativeTimeFormatUnit } | null {
  const ms = ahora - desde;
  if (!Number.isFinite(ms) || ms < MINUTO) return null;
  const [unidad, tamano] = UNIDADES.find(([, t]) => ms >= t)!;
  return { valor: -Math.floor(ms / tamano), unidad };
}

/**
 * «hace 1 min», «hace 3 h», «ayer»… en el idioma de la página; `momento` («ahora mismo») si fue
 * hace menos de un minuto. En corto (por defecto) para una línea de estado; en largo para una frase.
 */
export function haceCuantoTexto(desde: number, ahora: number, idioma: string, momento: string, estilo: "short" | "long" = "short"): string {
  const r = haceCuanto(desde, ahora);
  if (!r) return momento;
  return new Intl.RelativeTimeFormat(idioma, { numeric: "auto", style: estilo }).format(r.valor, r.unidad);
}
