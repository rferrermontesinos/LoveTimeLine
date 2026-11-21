import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import inicioEn from "../../../messages/en/inicio.json";
import inicioEs from "../../../messages/es/inicio.json";
import creditos from "../../../public/muestras/creditos.json";
import { SELECCION } from "../../../scripts/muestras/seleccion";
import { esFechaValida, esFutura } from "@/domain/fechas/fecha";
import { MAX_DESCRIPCION } from "@/domain/mazo/limites";
import { obtenerEstilo } from "@/lib/estilos";
import { MUESTRAS, type ClaveMuestra } from "./muestras";

const claves = Object.keys(MUESTRAS) as ClaveMuestra[];

describe("cartas de muestra", () => {
  it("hay una por foto elegida de Pexels, y ninguna más", () => {
    expect([...claves].sort()).toEqual(SELECCION.map((f) => f.id).sort());
  });

  it("sus fotos, grande y ligera, están en public/", () => {
    for (const c of claves) {
      const { foto, mini } = MUESTRAS[c];
      expect(foto).toBe(`/muestras/${c}.jpg`);
      expect(mini).toBe(`/muestras/mini/${c}.jpg`);
      for (const ruta of [foto, mini ?? ""]) expect(existsSync(path.join(process.cwd(), "public", ruta)), ruta).toBe(true);
    }
  });

  it("todas tienen créditos publicados", () => {
    const conCredito = new Set(creditos.fotos.map((f) => f.id));
    for (const c of claves) expect(conCredito.has(c), c).toBe(true);
  });

  it("sus fechas son válidas, no futuras y no se repiten", () => {
    for (const c of claves) {
      const f = MUESTRAS[c].fecha;
      expect(esFechaValida(f), c).toBe(true);
      expect(esFutura(f, new Date()), c).toBe(false);
    }
    const iso = claves.map((c) => JSON.stringify(MUESTRAS[c].fecha));
    expect(new Set(iso).size).toBe(iso.length);
  });

  it("usan paletas del estilo por defecto", () => {
    const paletas = new Set(obtenerEstilo(undefined).paletas.map((p) => p.id));
    for (const c of claves) expect(paletas.has(MUESTRAS[c].paletaId), `${c}: ${MUESTRAS[c].paletaId}`).toBe(true);
  });

  it.each([
    ["es", inicioEs.inicio.muestras],
    ["en", inicioEn.inicio.muestras],
  ] as const)("cada una tiene su frase en %s, de 90 caracteres como mucho", (_idioma, frases) => {
    expect(Object.keys(frases).sort()).toEqual([...claves].sort());
    for (const [clave, frase] of Object.entries(frases)) {
      expect(frase.trim(), clave).not.toBe("");
      expect([...frase].length, clave).toBeLessThanOrEqual(MAX_DESCRIPCION);
    }
  });
});
