import { describe, expect, it } from "vitest";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

function claves(o: Record<string, unknown>, prefijo = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? claves(v as Record<string, unknown>, `${prefijo}${k}.`) : [`${prefijo}${k}`],
  );
}

describe("traducciones", () => {
  it("todos los idiomas tienen las mismas claves", () => {
    expect(claves(en).sort()).toEqual(claves(es).sort());
  });

  it("ningún texto usa la marca registrada de otro juego", () => {
    const todo = JSON.stringify([es, en]);
    expect(/timeline/i.test(todo)).toBe(false);
  });
});
