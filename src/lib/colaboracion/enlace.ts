/**
 * Forma del enlace para pedir fotos: `/<idioma>/aportar/<id>#k=<huella de la clave del dueño>`.
 * Lo de tras «#» no sale del navegador de quien lo abre: ni el servicio ni la web lo reciben.
 */

const ID = /^[A-Za-z0-9_-]{22}$/;
const HUELLA = /^[A-Za-z0-9_-]{43}$/;

export function esIdEnlace(id: string): boolean {
  return ID.test(id);
}

export function urlParaCompartir(origen: string, locale: string, enlace: { id: string; huellaClave: string }): string {
  return `${origen}/${locale}/aportar/${enlace.id}#k=${enlace.huellaClave}`;
}

/** La huella de la clave del dueño, del «#k=…» del enlace. Null si no está o no tiene forma de huella. */
export function huellaDelEnlace(hash: string): string | null {
  const k = new URLSearchParams(hash.replace(/^#/, "")).get("k");
  return k && HUELLA.test(k) ? k : null;
}
