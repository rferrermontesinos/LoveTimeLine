import { describe, expect, it } from "vitest";
import { desdeIso, type FechaCarta } from "../fechas/fecha";
import { cartaConfigurada, cartasPendientes, pasoMaximo, pendientesDeCarta, puedeIrAEstilo, siguientePendiente, tieneHueco, type CartaParaConfigurar } from "./configuracion";
import { siguienteQue } from "./ordenar";

const hoy = new Date("2026-11-04T10:00:00");
const foto = (iso: string | null, extra: Partial<CartaParaConfigurar> = {}): CartaParaConfigurar & { id: string } => ({
  id: `f-${iso}-${Math.random()}`,
  tipo: "foto",
  fecha: iso ? desdeIso(iso) : null,
  revisar: false,
  descripcion: "",
  ...extra,
});
const texto = (iso: string | null, descripcion: string) => foto(iso, { tipo: "texto", descripcion });

describe("cartaConfigurada", () => {
  it("una carta con fecha válida y no futura está lista; la frase es opcional", () => {
    expect(cartaConfigurada(foto("2019-08-14"), hoy)).toBe(true);
    expect(cartaConfigurada(foto("2019"), hoy)).toBe(true);
    expect(cartaConfigurada(foto("2026-11-04"), hoy)).toBe(true);
  });

  it("sin fecha, con fecha futura o imposible, está pendiente", () => {
    expect(pendientesDeCarta(foto(null), hoy)).toEqual(["sin-fecha"]);
    expect(pendientesDeCarta(foto("2026-11-05"), hoy)).toEqual(["fecha-futura"]);
    expect(pendientesDeCarta({ ...foto(null), fecha: { anio: 2019, mes: 2, dia: 30 } as FechaCarta }, hoy)).toEqual(["fecha-invalida"]);
  });

  it("una fecha de un mazo antiguo marcada para revisar hay que confirmarla", () => {
    expect(pendientesDeCarta(foto("2016-07-10", { revisar: true }), hoy)).toEqual(["fecha-por-confirmar"]);
  });

  it("la frase no puede pasar de 90 caracteres (los emojis cuentan como uno)", () => {
    expect(pendientesDeCarta(foto("2019", { descripcion: "x".repeat(91) }), hoy)).toEqual(["descripcion-larga"]);
    expect(cartaConfigurada(foto("2019", { descripcion: "❤".repeat(90) }), hoy)).toBe(true);
  });

  it("una carta de texto necesita su texto, sin huecos entre corchetes", () => {
    expect(pendientesDeCarta(texto("1950", ""), hoy)).toEqual(["texto-vacio"]);
    expect(pendientesDeCarta(texto("1950", "   "), hoy)).toEqual(["texto-vacio"]);
    expect(pendientesDeCarta(texto("1950", "Nació [nombre]"), hoy)).toEqual(["texto-con-hueco"]);
    expect(pendientesDeCarta(texto(null, "Nació [nombre]"), hoy)).toEqual(["sin-fecha", "texto-con-hueco"]);
    expect(cartaConfigurada(texto("1950", "Nació el abuelo Paco"), hoy)).toBe(true);
    // En una carta con foto, los corchetes son parte de la frase.
    expect(cartaConfigurada(foto("2019", { descripcion: "[risas]" }), hoy)).toBe(true);
  });

  it("detecta huecos vacíos o con texto", () => {
    expect(tieneHueco("Nació [nombre]")).toBe(true);
    expect(tieneHueco("Boda de [] y []")).toBe(true);
    expect(tieneHueco("Sin huecos")).toBe(false);
  });
});

describe("puedeIrAEstilo", () => {
  it("hace falta al menos una carta y ninguna pendiente", () => {
    expect(puedeIrAEstilo([], hoy)).toBe(false);
    expect(puedeIrAEstilo([foto("2019"), foto("2020-01")], hoy)).toBe(true);
    expect(puedeIrAEstilo([foto("2019"), foto(null)], hoy)).toBe(false);
    expect(puedeIrAEstilo([foto("2019"), texto("1950", "Nació [nombre]")], hoy)).toBe(false);
    expect(pasoMaximo([foto("2019"), foto(null)], hoy)).toBe(2);
    expect(pasoMaximo([foto("2019")], hoy)).toBe(4);
  });

  it("lista las pendientes en orden y salta a la siguiente", () => {
    const cs = [foto(null), foto("2019"), foto("2030"), foto("2020")];
    expect(cartasPendientes(cs, hoy)).toEqual([cs[0]!.id, cs[2]!.id]);
    expect(siguientePendiente(cs, 0, hoy)).toBe(2);
    expect(siguientePendiente(cs, 2, hoy)).toBe(0);
    expect(siguientePendiente(cs, -1, hoy)).toBe(0);
    expect(siguientePendiente([foto("2019")], 0, hoy)).toBe(-1);
    expect(siguientePendiente([], 0, hoy)).toBe(-1);
  });

  it("siguienteQue da la vuelta y termina en la de partida", () => {
    expect(siguienteQue([1, 2, 3], 1, (x) => x === 2)).toBe(1);
    expect(siguienteQue([1, 2, 3], 2, (x) => x === 1)).toBe(0);
  });
});
