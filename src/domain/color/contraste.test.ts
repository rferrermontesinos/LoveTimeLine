import { describe, expect, it } from "vitest";
import { contraste, luminancia, rgbDeHex } from "./contraste";

describe("contraste WCAG", () => {
  it("lee hexadecimales largos, cortos y sin almohadilla", () => {
    expect(rgbDeHex("#F7739E")).toEqual([247, 115, 158]);
    expect(rgbDeHex("fc3")).toEqual([255, 204, 51]);
    expect(() => rgbDeHex("rosa")).toThrow();
  });

  it("negro y blanco son los extremos", () => {
    expect(luminancia("#000000")).toBe(0);
    expect(luminancia("#FFFFFF")).toBe(1);
    expect(contraste("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contraste("#777", "#777")).toBe(1);
  });

  it("es simétrico y coincide con valores de referencia", () => {
    // Referencias calculadas con la fórmula de WCAG 2.1.
    expect(contraste("#141414", "#F7739E")).toBeCloseTo(6.93, 2);
    expect(contraste("#F7739E", "#141414")).toBeCloseTo(contraste("#141414", "#F7739E"), 10);
    expect(contraste("#F5F0E6", "#2E56E6")).toBeCloseTo(5.15, 2);
    expect(contraste("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
  });
});
