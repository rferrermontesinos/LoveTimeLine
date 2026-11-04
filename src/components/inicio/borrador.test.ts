import { describe, expect, it } from "vitest";
import type { CartaTexto, Mazo, Pedido } from "@/lib/mazo/tipos";
import { haceCuanto, marcaCierre, resumenBorrador, tiempoRelativo } from "./borrador";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const AHORA = Date.UTC(2026, 10, 4, 12, 0, 0);

const carta = (id: string): CartaTexto => ({
  id,
  tipo: "texto",
  fecha: { anio: 2015, mes: 9 },
  fuente: "manual",
  confianza: "alta",
  revisar: false,
  descripcion: "Un recuerdo",
  destacada: false,
  anadidaEn: 0,
});

const pedido = (estado: Pedido["estado"]): Pedido => ({ id: "PRUEBA-1", modo: "simulado", estado, totalCents: 4900, moneda: "EUR", cartasFisicas: 47, fecha: AHORA });

type Borrador = Pick<Mazo, "id" | "titulo" | "cartas" | "pedido" | "actualizadoEn">;
const mazo = (cambios: Partial<Borrador> = {}): Borrador => ({ id: "m1", titulo: "Ana y Leo", cartas: [carta("a"), carta("b")], pedido: null, actualizadoEn: AHORA - HORA, ...cambios });

describe("resumenBorrador", () => {
  it("sin mazo guardado no hay aviso", () => {
    expect(resumenBorrador(null)).toBeNull();
  });

  it("un mazo recién abierto, sin cartas ni pedido, tampoco", () => {
    expect(resumenBorrador(mazo({ cartas: [] }))).toBeNull();
    expect(resumenBorrador(mazo({ cartas: [], pedido: pedido("pendiente") }))).toBeNull();
  });

  it("resume título, cartas y cuándo se guardó", () => {
    expect(resumenBorrador(mazo())).toEqual({ id: "m1", titulo: "Ana y Leo", cartas: 2, pagado: false, actualizadoEn: AHORA - HORA });
  });

  it("quita los espacios del título y lo deja vacío si no hay (el aviso pone uno genérico)", () => {
    expect(resumenBorrador(mazo({ titulo: "  Ana y Leo  " }))?.titulo).toBe("Ana y Leo");
    expect(resumenBorrador(mazo({ titulo: "   " }))?.titulo).toBe("");
  });

  it("solo cuenta como pagado un pedido pagado", () => {
    expect(resumenBorrador(mazo({ pedido: pedido("pendiente") }))?.pagado).toBe(false);
    expect(resumenBorrador(mazo({ pedido: pedido("pagado") }))?.pagado).toBe(true);
    // Un pedido pagado se enseña aunque no queden cartas («Ver mi mazo»).
    expect(resumenBorrador(mazo({ cartas: [], pedido: pedido("pagado") }))).toMatchObject({ cartas: 0, pagado: true });
  });
});

describe("haceCuanto", () => {
  it("menos de un minuto, o la hora del dispositivo por detrás, no da tiempo", () => {
    expect(haceCuanto(AHORA, AHORA)).toBeNull();
    expect(haceCuanto(AHORA - 59_999, AHORA)).toBeNull();
    expect(haceCuanto(AHORA + HORA, AHORA)).toBeNull();
    expect(haceCuanto(Number.NaN, AHORA)).toBeNull();
  });

  it("usa la unidad mayor que cabe entera y redondea hacia abajo", () => {
    expect(haceCuanto(AHORA - MINUTO, AHORA)).toEqual({ valor: -1, unidad: "minute" });
    expect(haceCuanto(AHORA - 59 * MINUTO - 59_000, AHORA)).toEqual({ valor: -59, unidad: "minute" });
    expect(haceCuanto(AHORA - 2 * HORA - 5 * MINUTO, AHORA)).toEqual({ valor: -2, unidad: "hour" });
    expect(haceCuanto(AHORA - 23 * HORA - 59 * MINUTO, AHORA)).toEqual({ valor: -23, unidad: "hour" });
    expect(haceCuanto(AHORA - DIA, AHORA)).toEqual({ valor: -1, unidad: "day" });
    expect(haceCuanto(AHORA - 6 * DIA - 23 * HORA, AHORA)).toEqual({ valor: -6, unidad: "day" });
    expect(haceCuanto(AHORA - 7 * DIA, AHORA)).toEqual({ valor: -1, unidad: "week" });
    expect(haceCuanto(AHORA - 29 * DIA, AHORA)).toEqual({ valor: -4, unidad: "week" });
    expect(haceCuanto(AHORA - 30 * DIA, AHORA)).toEqual({ valor: -1, unidad: "month" });
    expect(haceCuanto(AHORA - 364 * DIA, AHORA)).toEqual({ valor: -12, unidad: "month" });
    expect(haceCuanto(AHORA - 365 * DIA, AHORA)).toEqual({ valor: -1, unidad: "year" });
    expect(haceCuanto(AHORA - 800 * DIA, AHORA)).toEqual({ valor: -2, unidad: "year" });
  });
});

describe("tiempoRelativo", () => {
  it("lo escribe en el idioma de la página, con palabras cuando las hay", () => {
    expect(tiempoRelativo(AHORA - 2 * HORA, AHORA, "es", "hace un momento")).toBe("hace 2 horas");
    expect(tiempoRelativo(AHORA - 2 * HORA, AHORA, "en", "just now")).toBe("2 hours ago");
    expect(tiempoRelativo(AHORA - DIA, AHORA, "es", "hace un momento")).toBe("ayer");
    expect(tiempoRelativo(AHORA - DIA, AHORA, "en", "just now")).toBe("yesterday");
    expect(tiempoRelativo(AHORA - 7 * DIA, AHORA, "es", "hace un momento")).toBe("la semana pasada");
  });

  it("si fue hace menos de un minuto, usa el texto que se le pasa", () => {
    expect(tiempoRelativo(AHORA - 10_000, AHORA, "es", "hace un momento")).toBe("hace un momento");
    expect(tiempoRelativo(AHORA - 10_000, AHORA, "en", "just now")).toBe("just now");
  });
});

describe("marcaCierre", () => {
  it("cambia cuando el mazo se vuelve a guardar: el aviso cerrado vuelve a salir si hay cambios", () => {
    const r = resumenBorrador(mazo())!;
    expect(marcaCierre(r)).toBe(`m1:${AHORA - HORA}`);
    expect(marcaCierre({ ...r, actualizadoEn: AHORA })).not.toBe(marcaCierre(r));
    expect(marcaCierre({ ...r, id: "m2" })).not.toBe(marcaCierre(r));
  });
});
