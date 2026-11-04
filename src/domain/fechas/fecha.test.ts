import { describe, expect, it } from "vitest";
import {
  aIso,
  compararFechas,
  conPrecision,
  crearFecha,
  desdeIso,
  esFutura,
  filaBienOrdenada,
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
