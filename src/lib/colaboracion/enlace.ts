/**
 * Forma del enlace para pedir fotos: `/<idioma>/aportar/<id>#k=<huella de la clave del dueño>`.
 * Lo de tras «#» no sale del navegador de quien lo abre: ni el servicio ni la web lo reciben.
 */

const ID = /^[A-Za-z0-9_-]{22}$/;
const HUELLA = /^[A-Za-z0-9_-]{43}$/;
/** Lo de tras «#», entero: solo la huella, sin nada más (ni otra «k» escondida detrás). */
const FRAGMENTO = /^#?k=([A-Za-z0-9_-]{43})$/;

export function esIdEnlace(id: unknown): id is string {
  return typeof id === "string" && ID.test(id);
}

export function esHuella(h: unknown): h is string {
  return typeof h === "string" && HUELLA.test(h);
}

/**
 * El enlace que se comparte. El id lo da el servicio: si no tiene la forma de un id, no se
 * construye (un servicio malicioso podría colar su propia «#k=» delante de la del dueño).
 */
export function urlParaCompartir(origen: string, locale: string, enlace: { id: string; huellaClave: string }): string {
  if (!esIdEnlace(enlace.id) || !esHuella(enlace.huellaClave)) throw new Error("Enlace mal formado");
  return `${origen}/${locale}/aportar/${encodeURIComponent(enlace.id)}#k=${enlace.huellaClave}`;
}

/** La huella de la clave del dueño, del «#k=…» del enlace. Null si no está o si hay algo más. */
export function huellaDelEnlace(hash: string): string | null {
  return FRAGMENTO.exec(hash)?.[1] ?? null;
}
