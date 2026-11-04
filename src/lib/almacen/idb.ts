/**
 * Almacén local del mazo (IndexedDB). En el prototipo las fotos no salen del dispositivo:
 * se guardan aquí la copia de trabajo y la miniatura de cada una, y el mazo en JSON.
 */
import { createStore, del, delMany, get, keys, set, setMany, type UseStore } from "idb-keyval";
import { migrarMazo } from "@/lib/mazo/migrar";
import type { Mazo } from "@/lib/mazo/tipos";

let tienda: UseStore | null = null;
function t(): UseStore {
  if (!tienda) tienda = createStore("baraja-recuerdos", "datos");
  return tienda;
}

const CLAVE_MAZO = "mazo-actual";
const clave = (id: string, tipo: "copia" | "mini") => `foto:${id}:${tipo}`;

export async function almacenDisponible(): Promise<boolean> {
  try {
    await set("prueba", 1, t());
    await del("prueba", t());
    return true;
  } catch {
    return false;
  }
}

export async function cargarMazo(): Promise<Mazo | null> {
  try {
    // Un mazo guardado con una versión anterior del portal se pone al día al cargarlo.
    return migrarMazo(await get(CLAVE_MAZO, t()));
  } catch {
    return null;
  }
}

export async function guardarMazo(mazo: Mazo | null): Promise<void> {
  try {
    if (mazo) await set(CLAVE_MAZO, mazo, t());
    else await del(CLAVE_MAZO, t());
  } catch (e) {
    console.warn("No se pudo guardar el mazo", e);
  }
}

export async function guardarFoto(id: string, copia: Blob, mini: Blob): Promise<void> {
  await setMany(
    [
      [clave(id, "copia"), copia],
      [clave(id, "mini"), mini],
    ],
    t(),
  );
}

export async function leerFoto(id: string, tipo: "copia" | "mini"): Promise<Blob | null> {
  try {
    return ((await get(clave(id, tipo), t())) as Blob | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Borra las fotos que ya no pertenecen al mazo (solo al cargar, cuando no hay historial). */
export async function limpiarHuerfanas(vivas: Set<string>): Promise<void> {
  try {
    const todas = (await keys(t())).map(String).filter((k) => k.startsWith("foto:"));
    const sobran = todas.filter((k) => !vivas.has(k.split(":")[1]!));
    if (sobran.length) await delMany(sobran, t());
  } catch {
    /* sin almacén: nada que limpiar */
  }
}

export async function borrarTodo(): Promise<void> {
  try {
    const todas = await keys(t());
    if (todas.length) await delMany(todas, t());
  } catch {
    /* sin almacén */
  }
}
