import { describe, expect, it } from "vitest";
import {
  aIso,
  compararFechas,
  conPrecision,
  crearFecha,
  desdeIso,
  esFutura,
  filaBienOrdenada,
  huecosValidos,
  precisionDe,
  puedeIrAntes,
  rangoDias,
  type FechaCarta,
} from "./fecha";

const f = (iso: string) => desdeIso(iso)!;

describe("fecha de carta", () => {
  it("guarda la precisión en el ISO", () => {
    expect(aIso({ anio: 2019 })).toBe("2019");
    expect(aIso({ anio: 2019, mes: 8 })).toBe("2019-08");
    expect(aIso({ anio: 2019, mes: 8, dia: 4 })).toBe("2019-08-04");
    expect(precisionDe(f("2019"))).toBe("anio");
    expect(precisionDe(f("2019-08"))).toBe("mes");
    expect(precisionDe(f("2019-08-04"))).toBe("dia");
  });

  it("valida fechas imposibles", () => {
    expect(crearFecha(2019, 2, 29)).toBeNull();
    expect(crearFecha(2020, 2, 29)).not.toBeNull();
    expect(crearFecha(2019, 13)).toBeNull();
    expect(desdeIso("2019-8")).toBeNull();
    expect(desdeIso("hola")).toBeNull();
  });

  it("calcula el rango de días que cubre cada precisión", () => {
    const [i, fin] = rangoDias(f("2019"));
    expect(fin - i).toBe(364);
    const [im, fm] = rangoDias(f("2020-02"));
    expect(fm - im).toBe(28);
  });

  it("ordena por el primer día y, a igualdad, la más precisa primero", () => {
    const fechas = ["2019", "2018-12-31", "2019-01-01", "2019-01", "2017"].map(f);
    const orden = [...fechas].sort(compararFechas).map(aIso);
    expect(orden).toEqual(["2017", "2018-12-31", "2019-01-01", "2019-01", "2019"]);
  });

  it("una carta con solo el año vale en cualquier punto de ese año", () => {
    expect(puedeIrAntes(f("2019"), f("2019-03-01"))).toBe(true);
    expect(puedeIrAntes(f("2019-03-01"), f("2019"))).toBe(true);
    expect(puedeIrAntes(f("2019-08"), f("2019-08-14"))).toBe(true);
    expect(puedeIrAntes(f("2020"), f("2019-12-31"))).toBe(false);
    expect(filaBienOrdenada([f("2015"), f("2015-06-01"), f("2016")])).toBe(true);
    expect(filaBienOrdenada([f("2016"), f("2015")])).toBe(false);
  });

  describe("dónde encaja una carta en la línea (regla de Clásico y Nuestra historia)", () => {
    const linea = (...isos: string[]) => isos.map(f);

    it("dos cartas del mismo año valen en cualquier orden si alguna solo dice el año", () => {
      expect(huecosValidos(linea("2015-03-14"), f("2015"))).toEqual([0, 1]);
      expect(huecosValidos(linea("2015"), f("2015-08-02"))).toEqual([0, 1]);
      expect(huecosValidos(linea("2015"), f("2015"))).toEqual([0, 1]);
    });

    it("con dos fechas completas del mismo año, el orden sí cuenta", () => {
      expect(huecosValidos(linea("2015-03-14"), f("2015-08-02"))).toEqual([1]);
    });

    it("con el mismo mes, igual si alguna no dice el día", () => {
      expect(huecosValidos(linea("2015-03", "2015-06"), f("2015-03-20"))).toEqual([0, 1]);
      expect(huecosValidos(linea("2015-03-02", "2015-03-28"), f("2015-03"))).toEqual([0, 1, 2]);
    });

    it("una carta con solo el año cabe en cualquier punto de su año, y en ninguno fuera", () => {
      expect(huecosValidos(linea("2014", "2015-03", "2015-11", "2016"), f("2015"))).toEqual([1, 2, 3]);
      expect(huecosValidos(linea("2015", "2016"), f("2015-08-14"))).toEqual([0, 1]);
      expect(huecosValidos(linea("2012", "2013"), f("2015"))).toEqual([2]);
    });

    it("se mira toda la línea, no solo las vecinas", () => {
      // «2015» puede ir junto a las dos, pero marzo nunca va después de junio.
      expect(huecosValidos(linea("2015-06", "2015"), f("2015-03"))).toEqual([0]);
    });
  });

  it("recorta la precisión sin inventar datos", () => {
    const d: FechaCarta = { anio: 2019, mes: 8, dia: 14 };
    expect(aIso(conPrecision(d, "mes"))).toBe("2019-08");
    expect(aIso(conPrecision(d, "anio"))).toBe("2019");
    expect(aIso(conPrecision({ anio: 2019 }, "mes"))).toBe("2019");
  });

  it("detecta fechas futuras", () => {
    const hoy = new Date("2026-11-04T12:00:00");
    expect(esFutura(f("2026-11-05"), hoy)).toBe(true);
    expect(esFutura(f("2026-11-04"), hoy)).toBe(false);
    expect(esFutura(f("2026"), hoy)).toBe(false);
    expect(esFutura(f("2027"), hoy)).toBe(true);
  });
});
