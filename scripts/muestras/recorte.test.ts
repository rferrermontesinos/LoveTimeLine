import { describe, expect, it } from "vitest";
import { PRINT } from "../../config/print";
import { medidasSalida, recorteMuestra, type Caja } from "./recorte";

const CARTA = PRINT.carta.anchoMm / PRINT.carta.altoMm;

const dentro = (c: Caja, ancho: number, alto: number) => c.left >= 0 && c.top >= 0 && c.left + c.width <= ancho && c.top + c.height <= alto;

describe("recorteMuestra", () => {
  it("sin encuadre, saca el recorte más grande con la proporción de la carta, centrado", () => {
    // Apaisada: manda el alto.
    const apaisada = recorteMuestra(3000, 2000, CARTA);
    expect(apaisada.height).toBe(2000);
    expect(apaisada.width).toBe(Math.floor(2000 * CARTA));
    expect(apaisada.top).toBe(0);
    expect(Math.abs(apaisada.left + apaisada.width / 2 - 1500)).toBeLessThanOrEqual(1);
    // Vertical más estrecha que la carta: manda el ancho.
    const estrecha = recorteMuestra(1000, 2000, CARTA);
    expect(estrecha.width).toBe(1000);
    expect(estrecha.left).toBe(0);
    expect(Math.abs(estrecha.top + estrecha.height / 2 - 1000)).toBeLessThanOrEqual(1);
  });

  it("mantiene la proporción de la carta con un píxel de margen", () => {
    for (const [ancho, alto] of [
      [4000, 6000],
      [6000, 4000],
      [5472, 3648],
      [1080, 1920],
      [999, 1001],
    ] as const) {
      const c = recorteMuestra(ancho, alto, CARTA, { centroX: 0.3, centroY: 0.7, zoom: 1.2 });
      expect(Math.abs(c.width / c.height - CARTA)).toBeLessThan(1 / c.height + 1 / c.width);
    }
  });

  it("si el centro pedido lo sacaría de la foto, se arrima al borde", () => {
    const izquierda = recorteMuestra(3000, 2000, CARTA, { centroX: 0 });
    expect(izquierda.left).toBe(0);
    const derecha = recorteMuestra(3000, 2000, CARTA, { centroX: 1 });
    expect(derecha.left + derecha.width).toBe(3000);
    const abajo = recorteMuestra(2000, 4000, CARTA, { centroY: 1 });
    expect(abajo.top + abajo.height).toBe(4000);
  });

  it("acerca con el zoom y nunca aleja", () => {
    const sinZoom = recorteMuestra(3000, 2000, CARTA);
    const conZoom = recorteMuestra(3000, 2000, CARTA, { zoom: 1.25 });
    expect(conZoom.height).toBe(Math.floor(2000 / 1.25));
    expect(conZoom.width).toBeLessThan(sinZoom.width);
    expect(recorteMuestra(3000, 2000, CARTA, { zoom: 0.5 })).toEqual(sinZoom);
  });

  it("un centro que no es un número se trata como el centro", () => {
    expect(recorteMuestra(3000, 2000, CARTA, { centroX: Number.NaN, centroY: Number.POSITIVE_INFINITY })).toEqual(recorteMuestra(3000, 2000, CARTA));
  });

  it("siempre devuelve píxeles enteros dentro de la foto", () => {
    for (let i = 0; i < 200; i++) {
      // Medidas y encuadres variados, deterministas.
      const ancho = 200 + ((i * 7919) % 5800);
      const alto = 200 + ((i * 104_729) % 5800);
      const encuadre = { centroX: ((i * 37) % 101) / 100, centroY: ((i * 53) % 101) / 100, zoom: 1 + ((i * 13) % 50) / 50 };
      const c = recorteMuestra(ancho, alto, CARTA, encuadre);
      for (const v of [c.left, c.top, c.width, c.height]) expect(Number.isInteger(v)).toBe(true);
      expect(dentro(c, ancho, alto), JSON.stringify({ ancho, alto, encuadre, c })).toBe(true);
    }
  });

  it("rechaza medidas que no valen", () => {
    expect(() => recorteMuestra(0, 100, CARTA)).toThrow();
    expect(() => recorteMuestra(100, -1, CARTA)).toThrow();
    expect(() => recorteMuestra(100, 100, 0)).toThrow();
    expect(() => recorteMuestra(Number.NaN, 100, CARTA)).toThrow();
  });
});

describe("medidasSalida", () => {
  it("da el ancho que corresponde al alto con la proporción de la carta", () => {
    expect(medidasSalida(CARTA, 1400)).toEqual({ ancho: 1002, alto: 1400 });
    expect(medidasSalida(CARTA, 670)).toEqual({ ancho: 480, alto: 670 });
  });
});
