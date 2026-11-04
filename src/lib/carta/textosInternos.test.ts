import { describe, expect, it } from "vitest";
import { MENSAJES } from "../../../messages";
import { TEXTOS_INTERNOS, textosInternos } from "./textosInternos";

function claves(o: Record<string, unknown>, prefijo = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? claves(v as Record<string, unknown>, `${prefijo}${k}.`) : [`${prefijo}${k}`],
  );
}

describe("textos de las herramientas internas", () => {
  it("el inglés tiene las mismas claves que el español", () => {
    expect(claves(TEXTOS_INTERNOS.en).sort()).toEqual(claves(TEXTOS_INTERNOS.es).sort());
  });

  it("elige el idioma por su base y, si no lo hay, el español", () => {
    expect(textosInternos("en-GB")).toBe(TEXTOS_INTERNOS.en);
    expect(textosInternos("es")).toBe(TEXTOS_INTERNOS.es);
    expect(textosInternos("fr")).toBe(TEXTOS_INTERNOS.es);
  });

  // Los mensajes públicos viajan enteros a cada página (HTML y JS): lo interno no puede estar ahí.
  it("no están en los mensajes públicos", () => {
    for (const idioma of ["es", "en"] as const) {
      const publicos = MENSAJES[idioma] as Record<string, unknown>;
      expect(publicos).not.toHaveProperty("interno");
      expect(publicos).not.toHaveProperty("muestrario");
      const folleto = Object.keys(TEXTOS_INTERNOS[idioma].folleto);
      expect(Object.keys(MENSAJES[idioma].instrucciones).filter((k) => folleto.includes(k))).toEqual([]);
      const todo = JSON.stringify(publicos);
      expect(todo).not.toContain("HERRAMIENTAS_INTERNAS");
      expect(todo).not.toContain("instrucciones:pdf");
      expect(todo).not.toContain(TEXTOS_INTERNOS[idioma].muestrario.texto);
    }
  });

  it("ni la marca registrada de otro juego ni nombres de los socios", () => {
    const todo = JSON.stringify(TEXTOS_INTERNOS);
    expect(/timeline/i.test(todo)).toBe(false);
    expect(/\b(Marc|Ricard|Jose|José)\b/.test(todo)).toBe(false);
  });
});
