import { describe, expect, it } from "vitest";
import { ajustarTexto, partirLineas, partirParrafos } from "./ajuste";

/** Letra de ancho fijo: cada carácter mide 0,5 veces el tamaño. */
const medirFijo = (texto: string, tamano: number) => [...texto].length * 0.5 * tamano;
const medir1 = (texto: string) => medirFijo(texto, 1);

describe("partirLineas", () => {
  it("reparte por palabras sin pasar del ancho", () => {
    // 10 caracteres por línea con tamaño 1 y ancho 5.
    expect(partirLineas("el día que nos conocimos", medir1, 5)).toEqual(["el día que", "nos", "conocimos"]);
  });

  it("corta por caracteres una palabra que no cabe", () => {
    expect(partirLineas("supercalifragilístico", medir1, 4)).toEqual(["supercal", "ifragilí", "stico"]);
  });

  it("acaba en «…» si pasa de las líneas máximas", () => {
    const lineas = partirLineas("uno dos tres cuatro cinco seis", medir1, 4, 2);
    expect(lineas).toHaveLength(2);
    expect(lineas[1]!.endsWith("…")).toBe(true);
    expect(medir1(lineas[1]!)).toBeLessThanOrEqual(4);
  });

  it("un texto vacío no da líneas", () => {
    expect(partirLineas("   ", medir1, 10)).toEqual([]);
  });
});

describe("partirParrafos", () => {
  it("respeta los saltos de línea y deja una sola línea vacía entre párrafos", () => {
    expect(partirParrafos("Para Ana\ny Leo", medir1, 10)).toEqual(["Para Ana", "y Leo"]);
    expect(partirParrafos("Para Ana y Leo.\n\n\n\nCon cariño", medir1, 5)).toEqual(["Para Ana y", "Leo.", "", "Con cariño"]);
  });

  it("sin saltos de línea, parte igual que partirLineas", () => {
    const texto = "el día que nos conocimos";
    expect(partirParrafos(texto, medir1, 5)).toEqual(partirLineas(texto, medir1, 5));
  });

  it("si se pasa de las líneas máximas, no acaba en una línea vacía", () => {
    const lineas = partirParrafos("uno dos\n\ntres", medir1, 4, 2);
    expect(lineas).toEqual(["uno dos…"]);
  });
});

describe("ajustarTexto", () => {
  const base = { medir: medirFijo, anchoMax: 48, altoMax: 40, tamanoMax: 9.5, tamanoMin: 4, interlineado: 1, lineasMax: 7 };

  it("un texto corto va al tamaño máximo, en las líneas que haga falta", () => {
    expect(ajustarTexto({ ...base, texto: "Boda" })).toMatchObject({ tamano: 9.5, lineas: ["Boda"], recortado: false });
    // «Nuestra boda» no cabe en una línea a 9,5 (57 > 48), pero en dos sí, sin bajar de tamaño.
    expect(ajustarTexto({ ...base, texto: "Nuestra boda" })).toMatchObject({ tamano: 9.5, lineas: ["Nuestra", "boda"] });
  });

  it("un texto largo baja de tamaño hasta caber en el alto y en el ancho", () => {
    const texto = "La noche que se fue la luz en todo el barrio y cenamos a la luz de las velas en la terraza";
    expect([...texto].length).toBeLessThanOrEqual(90);
    const a = ajustarTexto({ ...base, texto });
    expect(a.tamano).toBeLessThan(9.5);
    expect(a.tamano).toBeGreaterThanOrEqual(4);
    expect(a.alto).toBeLessThanOrEqual(40);
    expect(a.lineas.length).toBeLessThanOrEqual(7);
    for (const l of a.lineas) expect(medirFijo(l, a.tamano)).toBeLessThanOrEqual(48);
    expect(a.lineas.join(" ")).toBe(texto);
    expect(a.recortado).toBe(false);
  });

  it("no parte palabras mientras pueda bajar de tamaño", () => {
    // «Desoxirribonucleico» (19 caracteres) no cabe en 48 a 9,5 (90,25) pero sí a 5 (47,5).
    const a = ajustarTexto({ ...base, texto: "Desoxirribonucleico" });
    expect(a.lineas).toEqual(["Desoxirribonucleico"]);
    expect(a.tamano).toBeLessThanOrEqual(5.05);
  });

  it("si no cabe ni al mínimo, recorta con «…» y lo dice", () => {
    const a = ajustarTexto({ ...base, altoMax: 8, lineasMax: 7, texto: "uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis" });
    expect(a.tamano).toBe(4);
    expect(a.recortado).toBe(true);
    expect(a.lineas.at(-1)!.endsWith("…")).toBe(true);
    expect(a.alto).toBeLessThanOrEqual(8);
  });

  it("cuenta los saltos de línea de la dedicatoria", () => {
    const a = ajustarTexto({ ...base, texto: "Para Ana\n\nCon cariño" });
    expect(a.lineas).toEqual(["Para Ana", "", "Con cariño"]);
    expect(a.alto).toBeCloseTo(3 * a.tamano, 6);
  });

  it("es determinista y siempre devuelve un tamaño entre el mínimo y el máximo", () => {
    for (const texto of ["a", "Nació la abuela Carmen", "x".repeat(90)]) {
      const a = ajustarTexto({ ...base, texto });
      expect(a.tamano).toBeGreaterThanOrEqual(4);
      expect(a.tamano).toBeLessThanOrEqual(9.5);
      expect(ajustarTexto({ ...base, texto })).toEqual(a);
    }
  });
});
