import { describe, expect, it } from "vitest";
import { IMPRENTAS, MM_POR_PULGADA, PRINT, paginaImprenta } from "@config/print";
import { ajusteSangrado, baseArchivo } from "./imprimir";

const pxPorMm = PRINT.ppp / MM_POR_PULGADA;
const cara = { anchoPx: 815, altoPx: 1110, pxPorMm, disenoMm: 3 };

describe("ajusteSangrado", () => {
  it("con más sangrado que el diseño, amplía cada lado; con menos, recorta", () => {
    expect(ajusteSangrado({ ...cara, imprentaMm: 4 })).toEqual({ cambioPx: 12, anchoPx: 839, altoPx: 1134 });
    expect(ajusteSangrado({ ...cara, imprentaMm: 3 })).toEqual({ cambioPx: 0, anchoPx: 815, altoPx: 1110 });
    expect(ajusteSangrado({ ...cara, imprentaMm: 2 })).toEqual({ cambioPx: -12, anchoPx: 791, altoPx: 1086 });
  });

  it("no amplía más de lo que mide el sangrado del diseño (el espejo copiaría la carta)", () => {
    expect(() => ajusteSangrado({ ...cara, imprentaMm: 7 })).toThrow(/Sangrado/);
    expect(() => ajusteSangrado({ ...cara, imprentaMm: -1 })).toThrow(/Sangrado/);
  });
});

describe("imprentas", () => {
  it("cada una tiene un id propio y un sangrado que el archivo puede dar", () => {
    expect(new Set(IMPRENTAS.map((p) => p.id)).size).toBe(IMPRENTAS.length);
    for (const p of IMPRENTAS) expect(() => ajusteSangrado({ ...cara, disenoMm: PRINT.sangradoMm, imprentaMm: p.sangradoMm })).not.toThrow();
  });

  it("lo que pide cada una: sangrado, marcas y reparto de páginas", () => {
    const por = Object.fromEntries(IMPRENTAS.map((p) => [p.id, p]));
    expect(por.agr).toMatchObject({ sangradoMm: 4, marcasCorte: false, paginas: "separadas" });
    expect(por.pinbro).toMatchObject({ sangradoMm: 3, marcasCorte: false, paginas: "intercaladas", maxBytesPagina: 3_000_000 });
    expect(por.soriano).toMatchObject({ sangradoMm: 2, marcasCorte: true, paginas: "intercaladas" });
  });

  it("la página es la carta con su sangrado y, con marcas, su margen", () => {
    const por = Object.fromEntries(IMPRENTAS.map((p) => [p.id, paginaImprenta(p)]));
    expect(por.agr).toMatchObject({ ancho: 71, alto: 96, margen: 0 });
    expect(por.pinbro).toMatchObject({ ancho: 69, alto: 94, margen: 0 });
    const m = PRINT.marcasCorte.margenMm;
    expect(por.soriano).toMatchObject({ ancho: 67 + 2 * m, alto: 92 + 2 * m, margen: m, cara: { ancho: 67, alto: 92 } });
  });
});

describe("baseArchivo", () => {
  it("sin acentos ni signos, con el número de cartas", () => {
    expect(baseArchivo("Ana y León: ¡10 años!", 48)).toBe("ana-y-leon-10-anos-48-cartas");
    expect(baseArchivo("", 40)).toBe("mazo-40-cartas");
  });
});
