/**
 * Almacén local del mazo (IndexedDB). En el prototipo las fotos no salen del dispositivo:
 * se guardan aquí la copia de trabajo y la miniatura de cada una, y el mazo en JSON.
 */
import { createStore, del, delMany, get, keys, set, setMany, update, type UseStore } from "idb-keyval";
import { mismaVersion, versionDe, type VersionMazo } from "@/lib/mazo/guardado";
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

/** El almacén está lleno: el navegador no deja guardar más en este dispositivo. */
export function esErrorDeEspacio(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  // 22: código antiguo de QuotaExceededError; Firefox lo llamaba NS_ERROR_DOM_QUOTA_REACHED.
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22;
}

export type ResultadoEscritura =
  | { ok: true }
  /** Lo guardado ya no es la versión de la que partía esta pestaña: otra se ha adelantado. */
  | { ok: false; motivo: "conflicto"; guardado: VersionMazo | null }
  | { ok: false; motivo: "espacio" | "error" };

/** Lanzado dentro de la transacción para no escribir: la deja sin cambios. */
class VersionDistinta extends Error {
  constructor(readonly guardado: VersionMazo | null) {
    super("versión distinta");
  }
}

/**
 * Guarda el mazo solo si lo guardado sigue siendo `base` (la última versión que esta pestaña leyó
 * o escribió). Comprobar y escribir van en la misma transacción: otra pestaña no puede colarse
 * entre las dos cosas.
 */
export async function escribirMazo(mazo: Mazo, base: VersionMazo | null): Promise<ResultadoEscritura> {
  try {
    await update(
      CLAVE_MAZO,
      (actual) => {
        const guardado = versionDe(actual);
        if (!mismaVersion(guardado, base)) throw new VersionDistinta(guardado);
        return mazo;
      },
      t(),
    );
    return { ok: true };
  } catch (e) {
    if (e instanceof VersionDistinta) return { ok: false, motivo: "conflicto", guardado: e.guardado };
    console.warn("No se pudo guardar el mazo", e);
    return { ok: false, motivo: esErrorDeEspacio(e) ? "espacio" : "error" };
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

/** Ids de las fotos guardadas en este dispositivo (ninguna si no hay almacén). */
export async function idsDeFotos(): Promise<Set<string>> {
  try {
    return new Set(
      (await keys(t()))
        .map(String)
        .filter((k) => k.startsWith("foto:"))
        .map((k) => k.split(":")[1]!),
    );
  } catch {
    return new Set();
  }
}

/** Borra estas fotos (copia y miniatura): las que ya no pertenecen al mazo. */
export async function borrarFotos(ids: Iterable<string>): Promise<void> {
  const claves = [...ids].flatMap((id) => [clave(id, "copia"), clave(id, "mini")]);
  if (!claves.length) return;
  try {
    await delMany(claves, t());
  } catch {
    /* sin almacén: nada que borrar */
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
