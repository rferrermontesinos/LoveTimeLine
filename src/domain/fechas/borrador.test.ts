import { describe, expect, it } from "vitest";
import { borradorDe, cambiarBorrador, estadoBorrador, type BorradorFecha } from "./borrador";

const hoy = new Date("2026-11-04T10:00:00");

/** Aplica los cambios en orden, como al teclear en la pantalla, y da el estado tras cada uno. */
function teclear(cambios: Partial<BorradorFecha>[], inicio: BorradorFecha = borradorDe(null, "dia")) {
  let b = inicio;
  return cambios.map((cambio) => {
    b = cambiarBorrador(b, cambio);
    return { borrador: b, ...estadoBorrador(b, hoy) };
  });
}

describe("borrador del selector de fecha", () => {
  it("29/02/2000 tecleado en el orden de la pantalla (día, mes y el año cifra a cifra) se guarda tal cual", () => {
    const estados = teclear([{ dia: "2" }, { dia: "29" }, { mes: "2" }, { anio: "2" }, { anio: "20" }, { anio: "200" }, { anio: "2000" }]);
    // Mientras se teclea el año, el día no se toca, no sale ningún error y no se guarda nada.
    for (const e of estados.slice(1, -1)) {
      expect(e.borrador.dia).toBe("29");
      expect(e.error).toBeNull();
      expect(e.fecha).toBeNull();
    }
    const final = estados.at(-1)!;
    expect(final.borrador).toEqual({ precision: "dia", dia: "29", mes: "2", anio: "2000" });
    expect(final.fecha).toEqual({ anio: 2000, mes: 2, dia: 29 });
    expect(final.error).toBeNull();
  });

  it("29/02/2019 no existe: avisa y no guarda ninguna fecha (ni el 28)", () => {
    const final = teclear([{ dia: "29" }, { mes: "2" }, { anio: "2019" }]).at(-1)!;
    expect(final.borrador.dia).toBe("29");
    expect(final.fecha).toBeNull();
    expect(final.error).toBe("invalida");
  });

  it("al corregir el año por uno bisiesto, la misma fecha pasa a valer", () => {
    const [, , , corregida] = teclear([{ dia: "29" }, { mes: "2" }, { anio: "2019" }, { anio: "2020" }]);
    expect(corregida!.fecha).toEqual({ anio: 2020, mes: 2, dia: 29 });
    expect(corregida!.error).toBeNull();
  });

  it("tampoco existen el 31 de abril ni el día 0", () => {
    expect(teclear([{ dia: "31" }, { mes: "4" }, { anio: "2020" }]).at(-1)).toMatchObject({ fecha: null, error: "invalida" });
    expect(teclear([{ dia: "0" }, { mes: "4" }, { anio: "2020" }]).at(-1)).toMatchObject({ fecha: null, error: "invalida" });
  });

  it("una fecha posterior a hoy avisa y no se guarda", () => {
    expect(teclear([{ dia: "5" }, { mes: "11" }, { anio: "2026" }]).at(-1)).toMatchObject({ fecha: null, error: "futura" });
    expect(teclear([{ dia: "4" }, { mes: "11" }, { anio: "2026" }]).at(-1)).toMatchObject({ fecha: { anio: 2026, mes: 11, dia: 4 }, error: null });
  });

  it("con el año pero sin el mes o el día que pide la precisión, está a medias (sin error)", () => {
    expect(teclear([{ anio: "1987" }]).at(-1)).toMatchObject({ fecha: null, error: null, aMedias: true });
    expect(teclear([{ precision: "mes" }, { anio: "1987" }]).at(-1)).toMatchObject({ aMedias: true });
    expect(teclear([{ precision: "anio" }, { anio: "1987" }]).at(-1)).toMatchObject({ fecha: { anio: 1987 }, aMedias: false });
    expect(teclear([{ precision: "mes" }, { mes: "6" }, { anio: "1987" }]).at(-1)).toMatchObject({ fecha: { anio: 1987, mes: 6 } });
  });

  it("solo limpia lo tecleado: cifras, como mucho 2 en el día y 4 en el año", () => {
    const b = cambiarBorrador(borradorDe(null, "dia"), { dia: "1a23", anio: "20x261" });
    expect(b).toMatchObject({ dia: "12", anio: "2026" });
  });

  it("parte de la fecha de la carta, con su precisión, o vacío", () => {
    expect(borradorDe({ anio: 1987, mes: 6 }, "dia")).toEqual({ precision: "mes", dia: "", mes: "6", anio: "1987" });
    expect(borradorDe({ anio: 2000, mes: 2, dia: 29 }, "anio")).toEqual({ precision: "dia", dia: "29", mes: "2", anio: "2000" });
    expect(borradorDe(null, "anio")).toEqual({ precision: "anio", dia: "", mes: "", anio: "" });
    expect(estadoBorrador(borradorDe(null, "dia"), hoy)).toEqual({ fecha: null, error: null, aMedias: false });
  });
});
