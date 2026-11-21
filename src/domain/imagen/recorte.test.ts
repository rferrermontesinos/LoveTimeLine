import { describe, expect, it } from "vitest";
import { encajar, limitarLado, pppEfectivo, recorteCentrado, recorteReversoDesdeAnverso, tamanoRotado } from "./recorte";

const ANVERSO = 69 / 94;
const REVERSO = 69 / 58;

describe("recortes", () => {
  it("recorta centrado como object-fit: cover", () => {
    const r = recorteCentrado(4000, 3000, ANVERSO);
    expect(r.alto).toBe(3000);
    expect(r.ancho).toBeCloseTo(3000 * ANVERSO);
    expect(r.x).toBeCloseTo((4000 - r.ancho) / 2);
    const v = recorteCentrado(3000, 4500, ANVERSO);
    expect(v.ancho).toBe(3000);
    expect(v.alto).toBeCloseTo(3000 / ANVERSO);
  });

  it("deriva el reverso dentro del anverso, un poco por encima del centro", () => {
    const a = recorteCentrado(3000, 4000, ANVERSO);
    const r = recorteReversoDesdeAnverso(a, REVERSO, 3000, 4000);
    expect(r.ancho / r.alto).toBeCloseTo(REVERSO);
    expect(r.x).toBeGreaterThanOrEqual(a.x);
    expect(r.y).toBeGreaterThanOrEqual(a.y);
    expect(r.x + r.ancho).toBeLessThanOrEqual(a.x + a.ancho + 1e-6);
    expect(r.y + r.alto).toBeLessThanOrEqual(a.y + a.alto + 1e-6);
    expect(r.y + r.alto / 2).toBeLessThan(a.y + a.alto / 2);
  });

  it("calcula la resolución efectiva", () => {
    // 815 px en 69 mm ≈ 300 ppp
    expect(pppEfectivo({ x: 0, y: 0, ancho: 815, alto: 1110 }, 69)).toBeCloseTo(300, 0);
  });

  it("encaja rectángulos dentro de la imagen", () => {
    expect(encajar({ x: -10, y: 950, ancho: 100, alto: 100 }, 1000, 1000)).toEqual({ x: 0, y: 900, ancho: 100, alto: 100 });
  });

  it("gira tamaños y limita el lado mayor", () => {
    expect(tamanoRotado(4000, 3000, 90)).toEqual({ ancho: 3000, alto: 4000 });
    expect(tamanoRotado(4000, 3000, -180)).toEqual({ ancho: 4000, alto: 3000 });
    expect(limitarLado(6000, 4000, 3000)).toEqual({ ancho: 3000, alto: 2000, factor: 0.5 });
    expect(limitarLado(600, 400, 3000).factor).toBe(1);
  });
});
