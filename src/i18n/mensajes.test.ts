import { describe, expect, it } from "vitest";
import { MENSAJES, PARTES } from "../../messages";

function claves(o: Record<string, unknown>, prefijo = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? claves(v as Record<string, unknown>, `${prefijo}${k}.`) : [`${prefijo}${k}`],
  );
}

describe("traducciones", () => {
  it("todos los idiomas tienen las mismas claves", () => {
    expect(claves(MENSAJES.en).sort()).toEqual(claves(MENSAJES.es).sort());
  });

  it("cada archivo de un idioma tiene los mismos espacios de nombres que en español", () => {
    PARTES.es.forEach((parte, i) => {
      expect(Object.keys(PARTES.en[i]!).sort()).toEqual(Object.keys(parte).sort());
    });
  });

  it("ningún espacio de nombres se repite entre archivos (se pisarían al juntarlos)", () => {
    const vistos = PARTES.es.flatMap((parte) => Object.keys(parte));
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  it("ningún texto usa la marca registrada de otro juego", () => {
    const todo = JSON.stringify(MENSAJES);
    expect(/timeline/i.test(todo)).toBe(false);
  });
});
