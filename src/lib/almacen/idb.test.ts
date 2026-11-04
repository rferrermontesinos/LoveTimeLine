import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mazo } from "@/lib/mazo/tipos";
import { borrarFotos, escribirMazo, esErrorDeEspacio, guardarFoto, idsDeFotos } from "./idb";

/**
 * Un almacén falso en memoria con la misma promesa que idb-keyval: `update` lee y escribe en la
 * misma transacción, y si la función lanza, no escribe nada.
 */
const almacen = vi.hoisted(() => ({ datos: new Map<string, unknown>(), fallo: null as unknown }));

vi.mock("idb-keyval", () => ({
  createStore: () => ({}),
  get: async (k: string) => almacen.datos.get(k),
  set: async (k: string, v: unknown) => void almacen.datos.set(k, v),
  del: async (k: string) => void almacen.datos.delete(k),
  delMany: async (ks: string[]) => ks.forEach((k) => almacen.datos.delete(k)),
  keys: async () => [...almacen.datos.keys()],
  setMany: async (pares: [string, unknown][]) => pares.forEach(([k, v]) => almacen.datos.set(k, v)),
  update: async (k: string, f: (actual: unknown) => unknown) => {
    if (almacen.fallo) throw almacen.fallo;
    almacen.datos.set(k, f(almacen.datos.get(k)));
  },
}));

const datos = almacen.datos;

const mazo = (id: string, actualizadoEn: number) => ({ id, actualizadoEn, cartas: [] }) as unknown as Mazo;

beforeEach(() => {
  datos.clear();
  almacen.fallo = null;
});

describe("guardar el mazo sin pisar otra pestaña", () => {
  it("guarda si lo guardado sigue siendo la versión de la que partía", async () => {
    datos.set("mazo-actual", mazo("m1", 100));
    expect(await escribirMazo(mazo("m1", 200), { id: "m1", actualizadoEn: 100 })).toEqual({ ok: true });
    expect(datos.get("mazo-actual")).toEqual(mazo("m1", 200));
  });

  it("guarda el primero si no había nada y no partía de nada", async () => {
    expect(await escribirMazo(mazo("m1", 100), null)).toEqual({ ok: true });
    expect(datos.get("mazo-actual")).toEqual(mazo("m1", 100));
  });

  it("no escribe si otra pestaña se ha adelantado, y dice qué hay guardado", async () => {
    datos.set("mazo-actual", mazo("m1", 300));
    expect(await escribirMazo(mazo("m1", 200), { id: "m1", actualizadoEn: 100 })).toEqual({
      ok: false,
      motivo: "conflicto",
      guardado: { id: "m1", actualizadoEn: 300 },
    });
    expect(datos.get("mazo-actual")).toEqual(mazo("m1", 300));
  });

  it("no resucita un mazo que otra pestaña ha borrado", async () => {
    expect(await escribirMazo(mazo("m1", 200), { id: "m1", actualizadoEn: 100 })).toEqual({ ok: false, motivo: "conflicto", guardado: null });
    expect(datos.has("mazo-actual")).toBe(false);
  });

  it("distingue el almacén lleno de otros fallos", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    almacen.fallo = new DOMException("lleno", "QuotaExceededError");
    expect(await escribirMazo(mazo("m1", 200), null)).toEqual({ ok: false, motivo: "espacio" });
    almacen.fallo = new Error("otra cosa");
    expect(await escribirMazo(mazo("m1", 200), null)).toEqual({ ok: false, motivo: "error" });
    warn.mockRestore();
  });
});

describe("almacén lleno", () => {
  it("reconoce el error de cuota con sus nombres de siempre", () => {
    expect(esErrorDeEspacio(new DOMException("x", "QuotaExceededError"))).toBe(true);
    expect(esErrorDeEspacio({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(esErrorDeEspacio({ code: 22 })).toBe(true);
  });

  it("no confunde otros errores", () => {
    expect(esErrorDeEspacio(new Error("x"))).toBe(false);
    expect(esErrorDeEspacio(new DOMException("x", "AbortError"))).toBe(false);
    expect(esErrorDeEspacio(null)).toBe(false);
    expect(esErrorDeEspacio("QuotaExceededError")).toBe(false);
  });
});

describe("fotos sueltas", () => {
  it("lista las fotos guardadas y borra las indicadas (copia y miniatura) sin tocar el resto", async () => {
    const blob = new Blob(["x"]);
    await guardarFoto("a", blob, blob);
    await guardarFoto("b", blob, blob);
    datos.set("mazo-actual", mazo("m1", 1));
    expect([...(await idsDeFotos())].sort()).toEqual(["a", "b"]);
    await borrarFotos(["a"]);
    expect([...datos.keys()].sort()).toEqual(["foto:b:copia", "foto:b:mini", "mazo-actual"]);
    await borrarFotos([]);
    expect(await idsDeFotos()).toEqual(new Set(["b"]));
  });
});
