import { describe, expect, it } from "vitest";
import { leerAncla } from "./ancla";

describe("leerAncla", () => {
  it("quita la almohadilla y devuelve el id de la pestaña", () => {
    expect(leerAncla("#historia")).toBe("historia");
    expect(leerAncla("#clasico")).toBe("clasico");
    expect(leerAncla("historia")).toBe("historia");
  });

  it("sin ancla, o con la almohadilla sola, no hay nada", () => {
    expect(leerAncla("")).toBe("");
    expect(leerAncla("#")).toBe("");
  });

  it("descodifica lo que el navegador escapa", () => {
    expect(leerAncla("#cu%C3%A9ntalo")).toBe("cuéntalo");
    expect(leerAncla("#dos%20palabras")).toBe("dos palabras");
  });

  it("no lanza con un escape mal formado o cortado: lo devuelve tal cual", () => {
    for (const roto of ["#%", "#%E0%A4%A", "#100%", "#%ZZ", "#historia%"]) {
      expect(() => leerAncla(roto), roto).not.toThrow();
      expect(leerAncla(roto), roto).toBe(roto.slice(1));
    }
  });
});
