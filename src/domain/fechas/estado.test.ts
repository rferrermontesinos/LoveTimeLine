import { describe, expect, it } from "vitest";
import { aSugerencia, estadoInicial, puestaAMano, type EstadoFecha } from "./estado";
import type { ResultadoFecha } from "./proponer";

const deCamara: ResultadoFecha = {
  automatica: { fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta", pista: "camara" },
  sugerencias: [],
  escaneo: false,
  senales: [],
};

const deWhatsApp: ResultadoFecha = {
  automatica: null,
  sugerencias: [{ fecha: { anio: 2008, mes: 7 }, fuente: "nombre", motivo: "mes-de-envio" }],
  motivo: "mes-de-envio",
  escaneo: false,
  senales: [],
};

describe("estado de la fecha de una foto", () => {
  it("empieza con la fecha puesta sola, si era segura", () => {
    expect(estadoInicial(deCamara)).toEqual({ fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", confianza: "alta", motivo: undefined, sugerencias: [] });
  });

  it("si no, empieza en blanco con sus sugerencias y el motivo", () => {
    expect(estadoInicial(deWhatsApp)).toEqual({
      fecha: null,
      fuente: null,
      confianza: null,
      motivo: "mes-de-envio",
      sugerencias: [{ fecha: { anio: 2008, mes: 7 }, fuente: "nombre", motivo: "mes-de-envio" }],
    });
  });

  it("una fecha puesta sola pasa a sugerencia con su motivo; las puestas a mano y las en blanco no cambian", () => {
    const auto = estadoInicial(deCamara);
    expect(aSugerencia(auto, "sesion-de-escaneo")).toEqual({
      fecha: null,
      fuente: null,
      confianza: null,
      motivo: "sesion-de-escaneo",
      sugerencias: [{ fecha: { anio: 2019, mes: 8, dia: 14 }, fuente: "exif", motivo: "sesion-de-escaneo" }],
    });
    const aMano: EstadoFecha = { fecha: { anio: 1998 }, fuente: "manual", confianza: "alta", sugerencias: [] };
    expect(aSugerencia(aMano, "sesion-de-escaneo")).toBe(aMano);
    const enBlanco = estadoInicial(deWhatsApp);
    expect(aSugerencia(enBlanco, "sesion-de-escaneo")).toBe(enBlanco);
  });

  it("guarda los demás datos de quien la lleva", () => {
    const conMas = { ...estadoInicial(deCamara), id: "c1", frase: "Playa" };
    expect(aSugerencia(conMas, "sesion-de-escaneo")).toMatchObject({ id: "c1", frase: "Playa", fecha: null });
    expect(puestaAMano(conMas, { anio: 2001 })).toMatchObject({ id: "c1", frase: "Playa", fecha: { anio: 2001 } });
  });

  it("la fecha que pone una persona cuenta como puesta a mano y descarta las sugerencias", () => {
    expect(puestaAMano(estadoInicial(deWhatsApp), { anio: 2007 })).toEqual({ fecha: { anio: 2007 }, fuente: "manual", confianza: "alta", motivo: undefined, sugerencias: [] });
  });

  it("borrarla la deja en blanco sin motivo, con las sugerencias que tuviera", () => {
    expect(puestaAMano(estadoInicial(deCamara), null)).toEqual({ fecha: null, fuente: null, confianza: null, motivo: undefined, sugerencias: [] });
    expect(puestaAMano(estadoInicial(deWhatsApp), null)).toEqual({
      fecha: null,
      fuente: null,
      confianza: null,
      motivo: undefined,
      sugerencias: [{ fecha: { anio: 2008, mes: 7 }, fuente: "nombre", motivo: "mes-de-envio" }],
    });
  });
});
