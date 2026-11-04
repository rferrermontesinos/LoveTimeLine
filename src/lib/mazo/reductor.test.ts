import { describe, expect, it } from "vitest";
import { nuevaCartaTexto } from "./derivados";
import { ESTADO_INICIAL, reductor, type EstadoMazo } from "./reductor";
import type { Carta, CartaFoto } from "./tipos";

const carta = (id: string, anio?: number): CartaFoto => ({
  tipo: "foto",
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

const ppp = (c: Carta) => (c.tipo === "foto" ? c.pppConfirmado : null);

function nuevo(): EstadoMazo {
  return reductor(ESTADO_INICIAL, {
    tipo: "crear",
    id: "m1",
    ahora: 0,
    packId: "pequeno",
    idiomaMazo: "es",
    mecanicas: ["estrella"],
    titulo: "Nuestra historia",
  });
}

describe("reductor del mazo", () => {
  it("crea el mazo en la versión actual con el estilo y la paleta por defecto", () => {
    const e = nuevo();
    expect(e.mazo?.version).toBe(2);
    expect(e.mazo?.estiloId).toBe("naipe");
    expect(e.mazo?.paletaId).toBe("rosa");
    expect(e.mazo?.caja).toBeNull();
    expect(e.mazo?.paso).toBe(1);
  });

  it("estilo y paleta desconocidos vuelven a los de por defecto; la paleta se conserva si existe", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "cambiar", campo: "paletaId", valor: "cobalto" });
    expect(e.mazo?.paletaId).toBe("cobalto");
    e = reductor(e, { tipo: "cambiar", campo: "estiloId", valor: "familia" });
    expect(e.mazo?.estiloId).toBe("naipe");
    expect(e.mazo?.paletaId).toBe("cobalto");
    e = reductor(e, { tipo: "cambiar", campo: "paletaId", valor: "inexistente" });
    expect(e.mazo?.paletaId).toBe("rosa");
  });

  it("pone la misma fecha a varias cartas, borra las sugerencias y lo puede deshacer", () => {
    let e = nuevo();
    const conSugerencia = { ...carta("a"), sugerencias: [{ fecha: { anio: 2018 }, fuente: "nombre" as const }] };
    e = reductor(e, { tipo: "anadirCartas", cartas: [conSugerencia, carta("b"), carta("c", 2010)] });
    e = reductor(e, { tipo: "ponerFecha", ids: ["a", "b"], fecha: { anio: 2019, mes: 8 } });
    expect(e.mazo?.cartas.filter((c) => c.fecha?.anio === 2019)).toHaveLength(2);
    expect(e.mazo?.cartas[0]?.fuente).toBe("manual");
    expect(e.mazo?.cartas[0]?.sugerencias).toEqual([]);
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

  it("al borrar la carta de portada o la de la caja se quitan las dos", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("a", 2015), carta("b", 2016)] });
    e = reductor(e, { tipo: "cambiar", campo: "portadaId", valor: "a" });
    e = reductor(e, { tipo: "ponerCaja", caja: { origen: "carta", cartaId: "a" } });
    e = reductor(e, { tipo: "borrarCartas", ids: ["b"] });
    expect(e.mazo?.caja).toEqual({ origen: "carta", cartaId: "a" });
    e = reductor(e, { tipo: "borrarCartas", ids: ["a"] });
    expect(e.mazo?.portadaId).toBeNull();
    expect(e.mazo?.caja).toBeNull();
  });

  it("ordena por fecha con las cartas sin fecha al final", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("x"), carta("b", 2019), carta("a", 2001)] });
    e = reductor(e, { tipo: "ordenarPorFecha" });
    expect(e.mazo?.cartas.map((c) => c.id)).toEqual(["a", "b", "x"]);
  });
});

describe("cartas de texto", () => {
  it("se ordenan con las de foto y solo aceptan los campos comunes", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("f", 2019), nuevaCartaTexto("t", "El día que nos conocimos", { anio: 2012 }, 0)] });
    e = reductor(e, { tipo: "actualizarCarta", id: "t", cambios: { descripcion: "Nuestra primera cita", destacada: true, adornos: [], pppConfirmado: true } });
    const t = e.mazo?.cartas.find((c) => c.id === "t");
    expect(t).toEqual({ ...nuevaCartaTexto("t", "Nuestra primera cita", { anio: 2012 }, 0), destacada: true });
    e = reductor(e, { tipo: "ordenarPorFecha" });
    expect(e.mazo?.cartas.map((c) => c.id)).toEqual(["t", "f"]);
  });
});

describe("acciones de lote y pedido", () => {
  it("actualiza varias cartas con un solo paso de deshacer", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("a"), carta("b"), carta("c")] });
    const antes = e.pasado.length;
    e = reductor(e, { tipo: "actualizarCartas", ids: ["a", "c"], cambios: { pppConfirmado: true } });
    expect(e.mazo?.cartas.map(ppp)).toEqual([true, false, true]);
    expect(e.pasado.length).toBe(antes + 1);
    e = reductor(e, { tipo: "deshacer" });
    expect(e.mazo?.cartas.every((c) => !ppp(c))).toBe(true);
  });

  it("ajustar la selección al catálogo no se puede deshacer", () => {
    let e = nuevo();
    const antes = e.pasado.length;
    e = reductor(e, { tipo: "normalizarSeleccion", packId: "mediano", extras: [], mecanicas: ["estrella", "comodin"] });
    expect(e.mazo?.packId).toBe("mediano");
    expect(e.mazo?.mecanicas).toEqual(["estrella", "comodin"]);
    expect(e.pasado.length).toBe(antes);
  });

  it("el pedido no se pierde al deshacer y se marca como pagado", () => {
    let e = nuevo();
    e = reductor(e, { tipo: "anadirCartas", cartas: [carta("a", 2019)] });
    e = reductor(e, { tipo: "cambiar", campo: "paletaId", valor: "cobalto" });
    e = reductor(e, {
      tipo: "registrarPedido",
      pedido: { id: "p1", modo: "stripe", estado: "pendiente", totalCents: 4900, moneda: "EUR", cartasFisicas: 41, fecha: 0 },
    });
    e = reductor(e, { tipo: "pedidoPagado" });
    expect(e.mazo?.pedido?.estado).toBe("pagado");
    e = reductor(e, { tipo: "deshacer" });
    expect(e.mazo?.paletaId).toBe("rosa");
    expect(e.mazo?.pedido?.id).toBe("p1");
  });
});
