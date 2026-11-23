import { describe, expect, it } from "vitest";
import { CARTAS_POR_PERSONA, jugadoresPorMazo, vidas, vidasHistoriaCompleta } from "./reglas";

describe("cuántas personas caben", () => {
  it("con 40 cartas, de 2 a 4 personas y 5 como mucho", () => {
    expect(jugadoresPorMazo(40)).toEqual({ recomendado: 4, maximo: 5, porParejas: false });
  });

  it("con 60 cartas, hasta 6", () => {
    expect(jugadoresPorMazo(60)).toEqual({ recomendado: 6, maximo: 6, porParejas: false });
  });

  it("con 100 cartas, hasta 6 y el resto por parejas", () => {
    expect(jugadoresPorMazo(100)).toEqual({ recomendado: 6, maximo: 6, porParejas: true });
  });

  it("siempre queda al menos una carta para robar con el máximo de personas", () => {
    for (let n = 20; n <= 300; n++) {
      const { recomendado, maximo } = jugadoresPorMazo(n);
      expect(recomendado).toBeLessThanOrEqual(maximo);
      expect(n - 1 - maximo * CARTAS_POR_PERSONA).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("vidas", () => {
  it("una por persona más una", () => {
    expect([2, 3, 4, 5, 6].map(vidas)).toEqual([3, 4, 5, 6, 7]);
  });

  it("en Historia completa, una por cada 8 cartas", () => {
    expect([40, 60, 80, 100].map(vidasHistoriaCompleta)).toEqual([5, 8, 10, 13]);
  });
});
