import { describe, expect, it } from "vitest";
import { tieneHueco } from "@/domain/mazo/configuracion";
import { MAX_DESCRIPCION } from "@/domain/mazo/limites";
import { nuevaCartaTexto } from "./derivados";
import { ideasDeRecuerdo, ideasLibres, ideasParaProponer } from "./recuerdos";
import type { Carta } from "./tipos";

const texto = (descripcion: string): Carta => nuevaCartaTexto(descripcion, descripcion, null, 0);
const conFoto = (descripcion: string): Pick<Carta, "tipo" | "descripcion"> => ({ tipo: "foto", descripcion });

describe("ideas de recuerdos sin foto", () => {
  it("en español, las catorce de la lista y en su orden", () => {
    expect(ideasDeRecuerdo("es")).toEqual([
      "El día que nos conocimos",
      "Nuestra primera cita",
      "Nuestro primer beso",
      "Primer viaje juntos",
      "Nos fuimos a vivir juntos",
      "Nos dieron las llaves de casa",
      "Nos prometimos",
      "Nuestra boda",
      "Nació [nombre]",
      "Nacimiento del abuelo [nombre]",
      "Boda de los abuelos",
      "Primer día de cole de [nombre]",
      "Llegó [mascota] a casa",
      "Bodas de plata",
    ]);
  });

  it("van en el idioma del mazo, con los huecos en las mismas ideas en los dos idiomas", () => {
    const es = ideasDeRecuerdo("es");
    const en = ideasDeRecuerdo("en");
    expect(en).toHaveLength(es.length);
    expect(en[0]).toBe("The day we met");
    expect(ideasDeRecuerdo("en-GB")).toEqual(en);
    expect(ideasDeRecuerdo("es-ES")).toEqual(es);
    expect(en.map(tieneHueco)).toEqual(es.map(tieneHueco));
  });

  it("todas caben en una carta", () => {
    for (const idea of [...ideasDeRecuerdo("es"), ...ideasDeRecuerdo("en")]) expect([...idea].length).toBeLessThanOrEqual(MAX_DESCRIPCION);
  });
});

describe("ideasLibres", () => {
  it("quita las que ya son una carta sin foto (sin mirar mayúsculas ni espacios)", () => {
    const ideas = ["Nuestra boda", "Bodas de plata", "Nació [nombre]"];
    expect(ideasLibres(ideas, [texto("  nuestra   BODA ")])).toEqual(["Bodas de plata", "Nació [nombre]"]);
  });

  it("las de hueco siguen libres (puede haber varios nacimientos) y las frases de las fotos no cuentan", () => {
    const ideas = ["Nació [nombre]", "Nuestra boda"];
    expect(ideasLibres(ideas, [texto("Nació [nombre]"), conFoto("Nuestra boda")])).toEqual(ideas);
  });
});

describe("ideasParaProponer", () => {
  it("primero las destacadas, variadas para parejas y familias, hasta cuatro", () => {
    expect(ideasParaProponer("es", [])).toEqual(["El día que nos conocimos", "Primer viaje juntos", "Nuestra boda", "Nació [nombre]"]);
    expect(ideasParaProponer("en", [], 2)).toEqual(["The day we met", "Our first trip together"]);
  });

  it("sin las que ya están en el mazo: se completan con las siguientes", () => {
    const cartas = [texto("El día que nos conocimos"), texto("Nuestra boda")];
    expect(ideasParaProponer("es", cartas)).toEqual(["Primer viaje juntos", "Nació [nombre]", "Llegó [mascota] a casa", "Nuestra primera cita"]);
  });
});
