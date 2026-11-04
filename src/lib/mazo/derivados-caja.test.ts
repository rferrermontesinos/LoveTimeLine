import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import type { Catalogo, Extra } from "@/domain/precios/tipos";
import { datosCaja, datosPortada, esCajaPersonalizada, extraCajaPersonalizada, fotoCaja, nuevaCartaTexto, varianteCaja } from "./derivados";
import type { CartaFoto, FotoCaja, Mazo } from "./tipos";

const catalogo = catalogoJson as unknown as Catalogo;
const CAJA = catalogo.extras.find((x) => x.efecto === "caja-personalizada")!.id;

const foto = (id: string, anio: number, destacada = false): CartaFoto => ({
  tipo: "foto",
  id,
  nombreArchivo: `${id}.jpg`,
  tipoArchivo: "image/jpeg",
  hash: `h-${id}`,
  ancho: 2000,
  alto: 1500,
  anchoOriginal: 4000,
  altoOriginal: 3000,
  fecha: { anio },
  fuente: "manual",
  confianza: "alta",
  revisar: false,
  descripcion: "",
  descripcionEnAnverso: false,
  recorteAnverso: { x: 10, y: 0, ancho: 1000, alto: 1362 },
  recorteReverso: { x: 20, y: 30, ancho: 1500, alto: 1283 },
  reversoPersonalizado: false,
  destacada,
  adornos: [],
  pppConfirmado: false,
  anadidaEn: 0,
});

const propia: FotoCaja = {
  origen: "propia",
  id: "caja-propia",
  nombreArchivo: "caja.jpg",
  tipoArchivo: "image/jpeg",
  hash: "hc",
  ancho: 3200,
  alto: 2400,
  anchoOriginal: 6400,
  altoOriginal: 4800,
  recorte: { x: 0, y: 100, ancho: 3000, alto: 2600 },
};

const mazo = (cambios: Partial<Mazo> = {}): Mazo => ({
  version: 2,
  id: "m",
  creadoEn: 0,
  actualizadoEn: 0,
  packId: "pequeno",
  estiloId: "naipe",
  paletaId: "verde",
  titulo: "Ana y Leo",
  dedicatoria: "Para Ana y Leo",
  portadaId: null,
  caja: null,
  tono: "original",
  idiomaMazo: "es",
  mecanicas: [],
  extras: [],
  consentimientoFotos: 1,
  paso: 3,
  cartas: [foto("a", 2012), foto("b", 2019, true), nuevaCartaTexto("t", "El día que nos conocimos", { anio: 2010 }, 0), foto("c", 2024)],
  pedido: null,
  ...cambios,
});

describe("esCajaPersonalizada", () => {
  it("encuentra el extra por su efecto, no por su id", () => {
    const otroId: Extra[] = catalogo.extras.map((x) => (x.efecto === "caja-personalizada" ? { ...x, id: "otra-caja" } : x));
    expect(extraCajaPersonalizada({ extras: otroId })?.id).toBe("otra-caja");
    expect(esCajaPersonalizada({ extras: ["otra-caja"] }, { extras: otroId })).toBe(true);
    expect(esCajaPersonalizada({ extras: [CAJA] }, { extras: otroId })).toBe(false);
  });

  it("sin el extra, o con el extra retirado del catálogo, va la caja de siempre", () => {
    expect(esCajaPersonalizada({ extras: [] }, catalogo)).toBe(false);
    expect(esCajaPersonalizada({ extras: ["envoltorio-regalo"] }, catalogo)).toBe(false);
    expect(esCajaPersonalizada({ extras: [CAJA] }, catalogo)).toBe(true);
    const retirado = catalogo.extras.map((x) => (x.id === CAJA ? { ...x, activo: false } : x));
    expect(esCajaPersonalizada({ extras: [CAJA] }, { extras: retirado })).toBe(false);
    expect(varianteCaja({ extras: [CAJA] }, catalogo)).toBe("personalizada");
    expect(varianteCaja({ extras: [] }, catalogo)).toBe("generica");
  });
});

describe("fotoCaja", () => {
  it("por defecto, la foto de la portada con el recorte del reverso", () => {
    // Sin portada elegida, la portada es la primera estrella con foto.
    expect(fotoCaja(mazo())).toEqual({ id: "b", ancho: 2000, recorte: foto("b", 0).recorteReverso });
    expect(fotoCaja(mazo({ portadaId: "c" }))?.id).toBe("c");
  });

  it("la carta elegida para la caja, aunque la portada sea otra", () => {
    expect(fotoCaja(mazo({ portadaId: "c", caja: { origen: "carta", cartaId: "a" } }))?.id).toBe("a");
  });

  it("si la carta elegida ya no está o no tiene foto, vuelve a la de la portada", () => {
    expect(fotoCaja(mazo({ portadaId: "c", caja: { origen: "carta", cartaId: "borrada" } }))?.id).toBe("c");
    expect(fotoCaja(mazo({ portadaId: "c", caja: { origen: "carta", cartaId: "t" } }))?.id).toBe("c");
  });

  it("la foto propia, con su recorte", () => {
    expect(fotoCaja(mazo({ caja: propia }))).toEqual({ id: "caja-propia", ancho: 3200, recorte: propia.recorte });
  });

  it("un mazo sin fotos no tiene foto de caja", () => {
    expect(fotoCaja(mazo({ cartas: [nuevaCartaTexto("t", "Solo texto", { anio: 2020 }, 0)] }))).toBeNull();
  });
});

describe("datosCaja", () => {
  it("la genérica no lleva nada del mazo", () => {
    for (const cara of ["anverso", "reverso"] as const) {
      expect(datosCaja(mazo(), cara, "generica")).toEqual({ tipo: "caja", variante: "generica" });
    }
  });

  it("la personalizada lleva el título y, detrás, los años", () => {
    expect(datosCaja(mazo(), "anverso", "personalizada")).toEqual({ tipo: "caja", variante: "personalizada", titulo: "Ana y Leo", subtitulo: "2010–2024 · 4 recuerdos" });
    expect(datosCaja(mazo(), "reverso", "personalizada")).toEqual({ tipo: "caja", variante: "personalizada", titulo: "Ana y Leo", subtitulo: "2010–2024" });
  });

  it("la portada es solo portada, con la dedicatoria", () => {
    expect(datosPortada(mazo(), "reverso")).toMatchObject({ tipo: "portada", dedicatoria: "Para Ana y Leo", subtitulo: "2010–2024" });
    expect(datosPortada(mazo(), "anverso").variante).toBeUndefined();
  });
});
