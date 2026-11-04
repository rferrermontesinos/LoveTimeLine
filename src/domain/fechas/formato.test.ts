import { describe, expect, it } from "vitest";
import { etiquetaMesCarta, fechaCorta, fechaLegible, nombresMeses, textoFechaCarta } from "./formato";

describe("formato de fechas", () => {
  it("abrevia el mes en 3 letras según el idioma del mazo", () => {
    expect(Array.from({ length: 12 }, (_, i) => etiquetaMesCarta(i + 1, "es"))).toEqual([
      "ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
    ]);
    expect(etiquetaMesCarta(8, "en")).toBe("AUG");
    expect(etiquetaMesCarta(9, "en-GB")).toBe("SEP");
    expect(etiquetaMesCarta(3, "ca")).toBe("MAR");
  });

  it("compone el texto del reverso según la precisión", () => {
    expect(textoFechaCarta({ anio: 2019, mes: 8, dia: 14 }, "es")).toEqual({ anio: "2019", linea: "14 AGO" });
    expect(textoFechaCarta({ anio: 2019, mes: 6 }, "es")).toEqual({ anio: "2019", linea: "JUN" });
    expect(textoFechaCarta({ anio: 2019 }, "es")).toEqual({ anio: "2019", linea: "" });
    expect(textoFechaCarta({ anio: 2019, mes: 8, dia: 14 }, "en")).toEqual({ anio: "2019", linea: "14 AUG" });
  });

  it("muestra fechas legibles en el idioma del usuario", () => {
    expect(fechaLegible({ anio: 2019, mes: 8, dia: 14 }, "es")).toBe("14 de agosto de 2019");
    expect(fechaLegible({ anio: 2019, mes: 8 }, "es")).toBe("agosto de 2019");
    expect(fechaLegible({ anio: 2019 }, "es")).toBe("2019");
    expect(fechaLegible({ anio: 2019, mes: 8, dia: 14 }, "en")).toBe("August 14, 2019");
    expect(nombresMeses("es")[0]).toBe("enero");
  });

  it("tiene una forma corta para miniaturas, sin puntos de abreviatura", () => {
    expect(fechaCorta({ anio: 2009, mes: 12, dia: 22 }, "es")).toBe("22 dic 2009");
    expect(fechaCorta({ anio: 2009, mes: 12 }, "es")).toBe("dic 2009");
    expect(fechaCorta({ anio: 2009 }, "es")).toBe("2009");
    expect(fechaCorta({ anio: 2009, mes: 12, dia: 22 }, "en")).toBe("Dec 22, 2009");
  });
});
