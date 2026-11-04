import { describe, expect, it } from "vitest";
import { ESTADO_INICIAL, reductor, type EstadoMazo } from "./reductor";
import type { Carta } from "./tipos";

const carta = (id: string, anio?: number): Carta => ({
  id,
  nombreArchivo: `${id}.jpg`,
  tipoArchivo: "image/jpeg",
  hash: id,
  ancho: 1000,
  alto: 1000,
  anchoOriginal: 1000,
  altoOriginal: 1000,
  fecha: anio ? { anio } : null,
  fuente: anio ? "nombre" : null,
  confianza: anio ? "media" : null,
  revisar: false,
  descripcion: "",
  descripcionEnAnverso: false,
  recorteAnverso: { x: 0, y: 0, ancho: 100, alto: 100 },
  recorteReverso: { x: 0, y: 0, ancho: 100, alto: 80 },
  reversoPersonalizado: false,
  destacada: false,
  adornos: [],
  pppConfirmado: false,
  anadidaEn: 0,
});

function nuevo(): EstadoMazo {
  return reductor(ESTADO_INICIAL, {
    tipo: "crear",
    id: "m1",
    ahora: 0,
    packId: "pareja",
    estiloId: "pareja",
    idiomaMazo: "es",
    mecanicas: ["estrella"],
    titulo: "Nuestra historia",
  });
}

describe("reductor del mazo", () => {
  it("crea el mazo con la tinta por defecto del estilo", () => {
    const e = nuevo();
    expect(e.mazo?.tintaId).toBe("rosa");
    expect(e.mazo?.paso).toBe(1);
  });

  it("al cambiar de estilo conserva la tinta si existe y si no usa la de por defecto", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "cambiar", campo: "tintaId", valor: "cobalto" });
    e = reductor(e, { tipo: "cambiar", campo: "estiloId", valor: "familia" });
    expect(e.mazo?.tintaId).toBe("cobalto");
    e = reductor(e, { tipo: "cambiar", campo: "tintaId", valor: "amarillo" });
    e = reductor(e, { tipo: "cambiar", campo: "estiloId", valor: "pareja" });
    expect(e.mazo?.tintaId).toBe("rosa");
  });

  it("pone la misma fecha a varias cartas y lo puede deshacer", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("a"), carta("b"), carta("c", 2010)] });
    e = reductor(e, { tipo: "ponerFecha", ids: ["a", "b"], fecha: { anio: 2019, mes: 8 } });
    expect(e.mazo?.cartas.filter((c) => c.fecha?.anio === 2019)).toHaveLength(2);
    expect(e.mazo?.cartas[0]?.fuente).toBe("manual");
    e = reductor(e, { tipo: "deshacer" });
    expect(e.mazo?.cartas.filter((c) => c.fecha === null)).toHaveLength(2);
  });

  it("deshacer no cambia el paso actual", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("a", 2015)] });
    e = reductor(e, { tipo: "borrarCartas", ids: ["a"] });
    e = reductor(e, { tipo: "cambiar", campo: "paso", valor: 3 });
    e = reductor(e, { tipo: "deshacer" });
    expect(e.mazo?.cartas).toHaveLength(1);
    expect(e.mazo?.paso).toBe(3);
  });

  it("al borrar la carta de portada se quita la portada", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("a", 2015)] });
    e = reductor(e, { tipo: "cambiar", campo: "portadaId", valor: "a" });
    e = reductor(e, { tipo: "borrarCartas", ids: ["a"] });
    expect(e.mazo?.portadaId).toBeNull();
  });

  it("ordena por fecha con las cartas sin fecha al final", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("x"), carta("b", 2019), carta("a", 2001)] });
    e = reductor(e, { tipo: "ordenarPorFecha" });
    expect(e.mazo?.cartas.map((c) => c.id)).toEqual(["a", "b", "x"]);
  });
});

describe("acciones de lote y pedido", () => {
  it("actualiza varias cartas con un solo paso de deshacer", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("a"), carta("b"), carta("c")] });
    const antes = e.pasado.length;
    e = reductor(e, { tipo: "actualizarCartas", ids: ["a", "c"], cambios: { pppConfirmado: true } });
    expect(e.mazo?.cartas.map((c) => c.pppConfirmado)).toEqual([true, false, true]);
    expect(e.pasado.length).toBe(antes + 1);
    e = reductor(e, { tipo: "deshacer" });
    expect(e.mazo?.cartas.every((c) => !c.pppConfirmado)).toBe(true);
  });

  it("el pedido no se pierde al deshacer y se marca como pagado", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("a", 2019)] });
    e = reductor(e, { tipo: "cambiar", campo: "tintaId", valor: "cobalto" });
    e = reductor(e, {
      tipo: "registrarPedido",
      pedido: { id: "p1", modo: "stripe", estado: "pendiente", totalCents: 4900, moneda: "EUR", cartasFisicas: 41, fecha: 0 },
    });
    e = reductor(e, { tipo: "pedidoPagado" });
    expect(e.mazo?.pedido?.estado).toBe("pagado");
    e = reductor(e, { tipo: "deshacer" });
    expect(e.mazo?.tintaId).toBe("rosa");
    expect(e.mazo?.pedido?.id).toBe("p1");
  });
});
