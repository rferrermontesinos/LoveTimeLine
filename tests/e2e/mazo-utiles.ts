/**
 * Ayudas de las pruebas del configurador (mazo.spec.ts y sin-conexion.spec.ts).
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

const CARPETA = path.join(process.cwd(), "tests", "fixtures", "generadas");

/**
 * Las fotos sintéticas de `pnpm fixtures` (nunca fotos reales). Solo los archivos de la carpeta:
 * la subcarpeta escaner/ es para probar otras fechas.
 */
export function fotos(): string[] {
  return readdirSync(CARPETA, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.join(CARPETA, e.name))
    .sort();
}

/**
 * Las fotos que se quedan sin fecha al subirlas (ver scripts/fixtures.ts): las que no la llevan en
 * el nombre ni en sus datos («foto-7.jpg»). La fecha del archivo solo se sugiere: suele ser la de
 * una copia, no la del recuerdo.
 */
export function sinFechaAlSubir(archivo: string): boolean {
  return /^foto-\d+\.jpg$/.test(path.basename(archivo));
}

/**
 * Las que salen con una fecha aproximada, solo el mes: las de WhatsApp («IMG-…-WA0001.jpg», la del
 * envío) y las capturas de pantalla («Screenshot_…», la de la captura), todas de hace años.
 */
export function aproximada(archivo: string): boolean {
  return /^(IMG-\d{8}-WA\d+\.jpg|Screenshot_)/.test(path.basename(archivo));
}

/** Las fotos que salen ya con su fecha (de la cámara, del nombre o, aproximada, del envío): sus cartas quedan listas. */
export function conFecha(archivo: string): boolean {
  return !sinFechaAlSubir(archivo);
}

/**
 * En Fotos, pone el mismo año a todas las que no tienen fecha, como lo haría el cliente:
 * «Seleccionar», tocarlas, «Poner fecha» y el año. Devuelve cuántas eran.
 */
export async function ponerAnioALasSinFecha(page: Page, anio: number): Promise<number> {
  const grupo = page.getByTestId("fotos-sin-fecha");
  const sinFecha = await grupo.getByRole("button").all();
  await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
  for (const carta of sinFecha) await carta.click();
  await expect(page.getByText(`${sinFecha.length} seleccionadas`)).toBeVisible();
  await page.getByRole("button", { name: "Poner fecha", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Poner la misma fecha" });
  await dialogo.getByRole("radio", { name: "Solo el año" }).click();
  await dialogo.getByLabel("Año").fill(String(anio));
  await dialogo.getByRole("button", { name: `Poner esta fecha a ${sinFecha.length} fotos` }).click();
  await expect(dialogo).toBeHidden();
  await expect(grupo).toBeHidden();
  return sinFecha.length;
}

/** La línea del pie que dice si el mazo está guardado en el dispositivo. */
export function guardado(page: Page): Locator {
  return page.getByTestId("estado-guardado");
}

/** Lo justo del mazo guardado para las pruebas. */
export interface MazoGuardado {
  actualizadoEn: number;
  cartas: unknown[];
  pedido: unknown;
  [campo: string]: unknown;
}

/** El almacén del navegador, como lo usa src/lib/almacen/idb.ts. */
const ALMACEN = { base: "baraja-recuerdos", tabla: "datos", clave: "mazo-actual" };

/** Lee el mazo tal como está guardado en el navegador (IndexedDB). */
export async function leerMazo(page: Page): Promise<MazoGuardado | null> {
  return page.evaluate(async ({ base, tabla, clave }) => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open(base);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    try {
      return await new Promise<MazoGuardado | null>((ok, ko) => {
        const r = db.transaction(tabla).objectStore(tabla).get(clave);
        r.onsuccess = () => ok((r.result as MazoGuardado | undefined) ?? null);
        r.onerror = () => ko(r.error);
      });
    } finally {
      db.close();
    }
  }, ALMACEN);
}

/**
 * Cambia el mazo guardado sin pasar por la página, como lo haría otra pestaña que no avisa.
 * `cambio` se ejecuta en el navegador: no puede usar nada de fuera de la función.
 */
export async function cambiarMazo(page: Page, cambio: (m: MazoGuardado) => MazoGuardado): Promise<void> {
  await page.evaluate(
    async ({ base, tabla, clave, fuente }) => {
      const cambiar = new Function(`return (${fuente})`)() as (m: unknown) => unknown;
      const db = await new Promise<IDBDatabase>((ok, ko) => {
        const r = indexedDB.open(base);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
      try {
        await new Promise<void>((ok, ko) => {
          const tx = db.transaction(tabla, "readwrite");
          const almacen = tx.objectStore(tabla);
          const r = almacen.get(clave);
          r.onsuccess = () => almacen.put(cambiar(r.result), clave);
          tx.oncomplete = () => ok();
          tx.onerror = () => ko(tx.error);
        });
      } finally {
        db.close();
      }
    },
    { ...ALMACEN, fuente: cambio.toString() },
  );
}

/** Las claves del almacén del navegador (el mazo y cada foto: `foto:<id>:copia` y `foto:<id>:mini`). */
export async function clavesGuardadas(page: Page): Promise<string[]> {
  return page.evaluate(async ({ base, tabla }) => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open(base);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    try {
      return await new Promise<string[]>((ok, ko) => {
        const r = db.transaction(tabla).objectStore(tabla).getAllKeys();
        r.onsuccess = () => ok(r.result.map(String));
        r.onerror = () => ko(r.error);
      });
    } finally {
      db.close();
    }
  }, ALMACEN);
}

/** Los ids de las fotos guardadas en el navegador, sin repetir y ordenados. */
export async function fotosGuardadas(page: Page): Promise<string[]> {
  const ids = (await clavesGuardadas(page)).filter((k) => k.startsWith("foto:")).map((k) => k.split(":")[1]!);
  return [...new Set(ids)].sort();
}

/** Borra el mazo guardado y deja las fotos, como si se hubiera cortado antes de guardarlo por primera vez. */
export async function borrarSoloElMazo(page: Page): Promise<void> {
  await page.evaluate(async ({ base, tabla, clave }) => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open(base);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    try {
      await new Promise<void>((ok, ko) => {
        const tx = db.transaction(tabla, "readwrite");
        tx.objectStore(tabla).delete(clave);
        tx.oncomplete = () => ok();
        tx.onerror = () => ko(tx.error);
      });
    } finally {
      db.close();
    }
  }, ALMACEN);
}
