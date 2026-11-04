import { describe, expect, it } from "vitest";
import { migrarMazo } from "./migrar";

/** Un borrador tal y como lo guardaba la primera versión del portal (sin fotos reales). */
const v1 = () => ({
  version: 1,
  id: "m1",
  creadoEn: 1,
  actualizadoEn: 2,
  packId: "familia",
  estiloId: "familia",
  tintaId: "cobalto",
  titulo: "Ana y Leo",
  dedicatoria: "",
  portadaId: "a",
  tono: "original",
  idiomaMazo: "es",
  mecanicas: ["estrella", "cuentalo"],
  extras: ["pack-retos"],
  consentimientoFotos: 1,
  paso: 3,
  cartas: [
    {
      id: "a",
      nombreArchivo: "a.jpg",
      tipoArchivo: "image/jpeg",
      hash: "h",
      ancho: 10,
      alto: 10,
      anchoOriginal: 10,
      altoOriginal: 10,
      fecha: { anio: 2019 },
      fuente: "exif",
      confianza: "alta",
      revisar: false,
      descripcion: "",
      descripcionEnAnverso: false,
      recorteAnverso: { x: 0, y: 0, ancho: 10, alto: 10 },
      recorteReverso: { x: 0, y: 0, ancho: 10, alto: 8 },
      reversoPersonalizado: false,
      destacada: false,
      adornos: [],
      pppConfirmado: false,
      anadidaEn: 0,
    },
  ],
  pedido: null,
});

describe("migrar un mazo guardado", () => {
  it("pasa un borrador de la primera versión a la actual sin perder el trabajo", () => {
    const m = migrarMazo(v1());
    expect(m).not.toBeNull();
    expect(m?.version).toBe(2);
    expect(m?.packId).toBe("mediano");
    expect(m?.estiloId).toBe("naipe");
    expect(m?.paletaId).toBe("cobalto");
    expect(m?.caja).toBeNull();
    expect(m?.paso).toBe(3);
    expect(m?.titulo).toBe("Ana y Leo");
    expect(m?.portadaId).toBe("a");
    expect(m?.cartas).toHaveLength(1);
    expect(m?.cartas[0]?.tipo).toBe("foto");
    expect(m?.cartas[0]?.fecha).toEqual({ anio: 2019 });
    expect(m && "tintaId" in m).toBe(false);
    // Los extras y mecánicas retirados se limpian al abrir el configurador, con el catálogo.
    expect(m?.extras).toEqual(["pack-retos"]);
  });

  it("el pack pequeño de la primera versión era «pareja»", () => {
    expect(migrarMazo({ ...v1(), packId: "pareja" })?.packId).toBe("pequeno");
    expect(migrarMazo({ ...v1(), packId: "otro" })?.packId).toBe("otro");
  });

  it("deja igual un mazo que ya está en la versión actual", () => {
    const actual = migrarMazo(v1())!;
    expect(migrarMazo(actual)).toEqual(actual);
  });

  it("descarta lo que no se puede leer y arregla lo que se puede", () => {
    expect(migrarMazo(null)).toBeNull();
    expect(migrarMazo("mazo")).toBeNull();
    expect(migrarMazo({ ...v1(), version: 99 })).toBeNull();
    expect(migrarMazo({ ...v1(), id: 3 })).toBeNull();
    const raro = migrarMazo({
      ...migrarMazo(v1())!,
      estiloId: "inexistente",
      paletaId: "inexistente",
      paso: 9,
      mecanicas: ["estrella", 4],
      cartas: [{ id: "x", tipo: "video" }, { id: "t", tipo: "texto", descripcion: "Nuestra boda", fecha: null }, "basura"],
    });
    expect(raro?.estiloId).toBe("naipe");
    expect(raro?.paletaId).toBe("rosa");
    expect(raro?.paso).toBe(1);
    expect(raro?.mecanicas).toEqual(["estrella"]);
    expect(raro?.cartas.map((c) => c.id)).toEqual(["t"]);
  });
});
