import { describe, expect, it } from "vitest";
import { desdeIso } from "../fechas/fecha";
import { GRAVEDAD, validarMazo, type CartaParaValidar } from "./validar";
import { agruparPorAnio, ordenarPorFecha, rangoAnios, siguienteSinFecha } from "./ordenar";

const hoy = new Date("2026-11-04T10:00:00");
let n = 0;
const carta = (iso: string | null, extra: Partial<CartaParaValidar> = {}): CartaParaValidar => ({
  id: `c${++n}`,
  fecha: iso ? desdeIso(iso) : null,
  revisar: false,
  hash: `h${n}`,
  descripcion: "",
  ppp: 400,
  pppConfirmado: false,
  ...extra,
});
const mazo = (k: number) => Array.from({ length: k }, (_, i) => carta(`20${10 + (i % 15)}-0${1 + (i % 9)}-1${i % 10}`));

describe("validarMazo", () => {
  it("un mazo completo y limpio se puede pagar", () => {
    const r = validarMazo({ cartas: mazo(40).map((c, i) => ({ ...c, fecha: { anio: 1980 + i } })), minimo: 40, maximo: 300, hoy, pppMinimo: 300 });
    expect(r.avisos).toEqual([]);
    expect(r.puedePagar).toBe(true);
  });

  it("bloquea si faltan cartas o fechas", () => {
    const cartas = [...mazo(30), carta(null)];
    const r = validarMazo({ cartas, minimo: 40, maximo: 300, hoy, pppMinimo: 300 });
    expect(r.avisos.map((a) => a.tipo)).toContain("faltan-cartas");
    expect(r.avisos.map((a) => a.tipo)).toContain("sin-fecha");
    expect(r.puedePagar).toBe(false);
  });

  it("bloquea la caja personalizada sin foto", () => {
    const cartas = mazo(40).map((c, i) => ({ ...c, fecha: { anio: 1980 + i } }));
    const sin = validarMazo({ cartas, minimo: 40, maximo: 300, hoy, pppMinimo: 300, cajaSinFoto: true });
    expect(sin.avisos).toEqual([{ tipo: "caja-sin-foto" }]);
    expect(GRAVEDAD["caja-sin-foto"]).toBe("bloquea");
    expect(sin.puedePagar).toBe(false);
    expect(validarMazo({ cartas, minimo: 40, maximo: 300, hoy, pppMinimo: 300, cajaSinFoto: false }).puedePagar).toBe(true);
  });

  it("la baja resolución pide confirmación pero no bloquea una vez confirmada", () => {
    const base = Array.from({ length: 40 }, (_, i) => carta(String(1980 + i)));
    const conBaja = [...base.slice(1), { ...base[0]!, ppp: 180 }];
    const r = validarMazo({ cartas: conBaja, minimo: 40, maximo: 300, hoy, pppMinimo: 300 });
    expect(r.avisos.find((a) => a.tipo === "baja-resolucion")).toBeTruthy();
    expect(GRAVEDAD["baja-resolucion"]).toBe("confirmar");
    expect(r.puedePagar).toBe(false);
    const confirmado = [...base.slice(1), { ...base[0]!, ppp: 180, pppConfirmado: true }];
    expect(validarMazo({ cartas: confirmado, minimo: 40, maximo: 300, hoy, pppMinimo: 300 }).puedePagar).toBe(true);
  });

  it("avisa de fechas duplicadas exactas y fotos repetidas sin bloquear", () => {
    const base = Array.from({ length: 38 }, (_, i) => carta(String(1980 + i)));
    const a = carta("2019-08-14", { hash: "igual" });
    const b = carta("2019-08-14", { hash: "igual" });
    const r = validarMazo({ cartas: [...base, a, b], minimo: 40, maximo: 300, hoy, pppMinimo: 300 });
    const fechas = r.avisos.find((x) => x.tipo === "fechas-duplicadas");
    expect(fechas && "grupos" in fechas && fechas.grupos[0]).toEqual({ iso: "2019-08-14", cartas: [a.id, b.id] });
    expect(r.avisos.find((x) => x.tipo === "fotos-duplicadas")).toBeTruthy();
    expect(r.puedePagar).toBe(true);
  });

  it("bloquea descripciones de más de 90 caracteres y fechas futuras", () => {
    const base = Array.from({ length: 40 }, (_, i) => carta(String(1980 + i)));
    base[0]!.descripcion = "x".repeat(91);
    base[1]!.fecha = desdeIso("2030");
    const r = validarMazo({ cartas: base, minimo: 40, maximo: 300, hoy, pppMinimo: 300 });
    expect(r.avisos.map((a) => a.tipo)).toEqual(expect.arrayContaining(["descripcion-larga", "fecha-futura"]));
    expect(r.puedePagar).toBe(false);
  });

  it("bloquea las cartas sin foto con el texto vacío o con un hueco por rellenar", () => {
    const base = Array.from({ length: 38 }, (_, i) => carta(String(1980 + i)));
    const vacia = carta("1950", { tipo: "texto", descripcion: " ", hash: null, ppp: null });
    const hueco = carta("1951", { tipo: "texto", descripcion: "Nació [nombre]", hash: null, ppp: null });
    const r = validarMazo({ cartas: [...base, vacia, hueco], minimo: 40, maximo: 300, hoy, pppMinimo: 300 });
    expect(r.avisos).toContainEqual({ tipo: "texto-pendiente", cartas: [vacia.id, hueco.id] });
    expect(GRAVEDAD["texto-pendiente"]).toBe("bloquea");
    expect(r.puedePagar).toBe(false);
    const bien = carta("1952", { tipo: "texto", descripcion: "Nació el abuelo", hash: null, ppp: null });
    expect(validarMazo({ cartas: [...base, bien, carta("1953")], minimo: 40, maximo: 300, hoy, pppMinimo: 300 }).puedePagar).toBe(true);
  });

  it("cuenta los emojis como un carácter en la descripción", () => {
    const base = Array.from({ length: 40 }, (_, i) => carta(String(1980 + i)));
    base[0]!.descripcion = "❤".repeat(90);
    expect(validarMazo({ cartas: base, minimo: 40, maximo: 300, hoy, pppMinimo: 300 }).puedePagar).toBe(true);
  });
});

describe("ordenar", () => {
  it("ordena cronológicamente con las cartas sin fecha al final", () => {
    const cs = [carta("2019"), carta(null), carta("2015-03"), carta("2019-01-01")];
    expect(ordenarPorFecha(cs).map((c) => c.fecha && c.fecha.anio)).toEqual([2015, 2019, 2019, null]);
    expect(ordenarPorFecha(cs)[1]!.fecha).toEqual({ anio: 2019, mes: 1, dia: 1 });
  });

  it("agrupa por año y da el rango", () => {
    const cs = [carta("2019"), carta("2015-03"), carta("2019-01-01")];
    expect(agruparPorAnio(cs).map((g) => [g.anio, g.cartas.length])).toEqual([
      [2015, 1],
      [2019, 2],
    ]);
    expect(rangoAnios(cs)).toEqual([2015, 2019]);
    expect(rangoAnios([])).toBeNull();
  });

  it("salta a la siguiente carta sin fecha", () => {
    const cs = [carta(null), carta("2019"), carta(null), carta("2020")];
    expect(siguienteSinFecha(cs, 0)).toBe(2);
    expect(siguienteSinFecha(cs, 2)).toBe(0);
    expect(siguienteSinFecha([carta("2019")], 0)).toBe(-1);
  });
});
