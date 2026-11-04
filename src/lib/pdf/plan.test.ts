import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import { cotizar } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import { nuevaCartaTexto } from "@/lib/mazo/derivados";
import type { Carta, CartaFoto, FotoCaja, Mazo } from "@/lib/mazo/tipos";
import { cartasImpresas, planImpresion } from "./plan";

const catalogo = catalogoJson as unknown as Catalogo;
/** El extra de la caja personalizada se busca por su efecto, como hace el código. */
const CAJA = catalogo.extras.find((x) => x.efecto === "caja-personalizada")!.id;

const carta = (i: number, anio: number | null): CartaFoto => ({
  tipo: "foto",
  id: `c${i}`,
  nombreArchivo: `foto-${i}.jpg`,
  tipoArchivo: "image/jpeg",
  hash: `h${i}`,
  ancho: 2000,
  alto: 1500,
  anchoOriginal: 4000,
  altoOriginal: 3000,
  fecha: anio === null ? null : { anio, mes: 1 + (i % 12) },
  fuente: "manual",
  confianza: "alta",
  revisar: false,
  descripcion: "",
  descripcionEnAnverso: false,
  recorteAnverso: { x: 0, y: 0, ancho: 1000, alto: 1362 },
  recorteReverso: { x: 0, y: 0, ancho: 1500, alto: 1261 },
  reversoPersonalizado: false,
  destacada: false,
  adornos: [],
  pppConfirmado: false,
  anadidaEn: i,
});

const mazo = (n: number, cambios: Partial<Mazo> = {}): Mazo => ({
  version: 2,
  id: "m",
  creadoEn: 0,
  actualizadoEn: 0,
  packId: "pequeno",
  estiloId: "naipe",
  paletaId: "rosa",
  titulo: "Ana y Leo",
  dedicatoria: "",
  portadaId: null,
  caja: null,
  tono: "original",
  idiomaMazo: "es",
  mecanicas: ["estrella", "comodin", "en-blanco"],
  extras: [],
  consentimientoFotos: 1,
  paso: 4,
  // Años al revés para comprobar que el plan las ordena.
  cartas: Array.from({ length: n }, (_, i): Carta => carta(i, 2025 - i)),
  pedido: null,
  ...cambios,
});

const fotoPropia: FotoCaja = {
  origen: "propia",
  id: "caja-1",
  nombreArchivo: "caja.jpg",
  tipoArchivo: "image/jpeg",
  hash: "hc",
  ancho: 3000,
  alto: 2000,
  anchoOriginal: 3000,
  altoOriginal: 2000,
  recorte: { x: 100, y: 50, ancho: 2400, alto: 2100 },
};

describe("plan de impresión", () => {
  it("imprime tantas cartas como cobra la cotización", () => {
    const conTexto = mazo(38);
    conTexto.cartas.push(nuevaCartaTexto("t1", "El día que nos conocimos", { anio: 2012 }, 0), nuevaCartaTexto("t2", "Nuestra boda", { anio: 2016, mes: 6 }, 0));
    for (const [m, extras] of [
      [mazo(40), []],
      [mazo(47), ["envoltorio-regalo", "copia-extra"]],
      [mazo(40, { mecanicas: [] }), []],
      [mazo(40, { mecanicas: ["comodin"] }), [CAJA]],
      [conTexto, [CAJA]],
    ] as const) {
      const conExtras = { ...m, extras: [...extras] };
      const plan = planImpresion({ mazo: conExtras, catalogo, iconos: new Map() });
      const c = cotizar({ catalogo, packId: conExtras.packId, cartas: conExtras.cartas.length, extras: conExtras.extras, mecanicas: conExtras.mecanicas });
      expect(cartasImpresas(plan)).toBe(c.cartasFisicas);
    }
  });

  it("empieza por la portada, sigue el orden cronológico y no lleva la caja de siempre", () => {
    const plan = planImpresion({ mazo: mazo(42), catalogo, iconos: new Map() });
    expect(plan[0]?.clave).toBe("portada");
    expect(plan.some((p) => p.tipo === "caja")).toBe(false);
    const anios = plan.filter((p) => p.tipo === "foto").map((p) => p.caras[0].datos.fecha?.anio ?? 0);
    expect(anios).toEqual([...anios].sort((a, b) => a - b));
    expect(plan.filter((p) => p.tipo === "comodin")).toHaveLength(2);
    expect(plan.filter((p) => p.tipo === "en-blanco")).toHaveLength(4);
  });

  it("la portada usa la foto elegida y un extra retirado no imprime cartas", () => {
    const m = mazo(40, { extras: ["pack-retos"], portadaId: "c7" });
    const plan = planImpresion({ mazo: m, catalogo, iconos: new Map([["c3", "estrella"]]) });
    expect(plan.some((p) => p.clave.startsWith("pack-retos"))).toBe(false);
    expect(cartasImpresas(plan)).toBe(1 + 40 + 2 + 4);
    expect(plan[0]?.foto?.id).toBe("c7");
    expect(plan.find((p) => p.clave === "foto-c3")?.caras[0].datos.icono).toBe("estrella");
  });

  it("las cartas de texto van intercaladas por fecha, sin foto y con su icono", () => {
    const m = mazo(6);
    // Fotos de 2020 a 2025; los textos caen antes, en medio y después.
    m.cartas.push(
      nuevaCartaTexto("t1", "El día que nos conocimos", { anio: 1980 }, 0),
      nuevaCartaTexto("t2", "Nuestra boda", { anio: 2022, mes: 6, dia: 18 }, 0),
      nuevaCartaTexto("t3", "La casa nueva", { anio: 2030 }, 0),
    );
    const plan = planImpresion({ mazo: m, catalogo, iconos: new Map([["t2", "estrella"]]) });
    const recuerdos = plan.filter((p) => p.tipo === "foto" || p.tipo === "texto");
    expect(recuerdos.map((p) => p.clave)).toEqual(["texto-t1", "foto-c5", "foto-c4", "foto-c3", "texto-t2", "foto-c2", "foto-c1", "foto-c0", "texto-t3"]);
    // El más antiguo va justo después de la portada.
    expect(plan[1]?.clave).toBe("texto-t1");
    for (const p of recuerdos.filter((r) => r.tipo === "texto")) {
      expect(p.foto).toBeNull();
      expect(p.caras.map((c) => c.datos.tipo)).toEqual(["texto", "texto"]);
    }
    const boda = plan.find((p) => p.clave === "texto-t2")!;
    expect(boda.caras[1].datos).toMatchObject({ texto: "Nuestra boda", fecha: { anio: 2022, mes: 6, dia: 18 }, icono: "estrella" });
  });

  it("los comodines y las cartas en blanco llevan el icono del catálogo en las dos caras", () => {
    const plan = planImpresion({ mazo: mazo(40), catalogo, iconos: new Map() });
    const icono = (id: string) => catalogo.mecanicas.find((m) => m.id === id)!.icono;
    const comodines = plan.filter((p) => p.tipo === "comodin");
    const enBlanco = plan.filter((p) => p.tipo === "en-blanco");
    expect(comodines.map((p) => p.clave)).toEqual(["comodin-1", "comodin-2"]);
    expect(enBlanco.map((p) => p.clave)).toEqual(["en-blanco-1", "en-blanco-2", "en-blanco-3", "en-blanco-4"]);
    for (const p of comodines) expect(p.caras.map((c) => c.datos.icono)).toEqual([icono("comodin"), icono("comodin")]);
    for (const p of enBlanco) expect(p.caras.map((c) => c.datos.icono)).toEqual([icono("en-blanco"), icono("en-blanco")]);
    expect(plan.every((p) => p.tipo !== "comodin" || p.foto === null)).toBe(true);
  });

  it("sin la mecánica no imprime sus cartas", () => {
    const plan = planImpresion({ mazo: mazo(40, { mecanicas: ["estrella", "comodin"] }), catalogo, iconos: new Map() });
    expect(plan.filter((p) => p.tipo === "en-blanco")).toHaveLength(0);
    expect(plan.filter((p) => p.tipo === "comodin")).toHaveLength(2);
  });

  describe("caja personalizada", () => {
    const cajaDe = (m: Mazo) => planImpresion({ mazo: m, catalogo, iconos: new Map() }).find((p) => p.tipo === "caja");

    it("va al final, con sus dos caras, y no cuenta como carta", () => {
      const plan = planImpresion({ mazo: mazo(40, { extras: [CAJA] }), catalogo, iconos: new Map() });
      const caja = plan.at(-1)!;
      expect(caja.clave).toBe("caja");
      expect(caja.caras.map((c) => [c.cara, c.datos.tipo, c.datos.variante])).toEqual([
        ["anverso", "caja", "personalizada"],
        ["reverso", "caja", "personalizada"],
      ]);
      expect(caja.caras[0].datos.titulo).toBe("Ana y Leo");
      expect(cartasImpresas(plan)).toBe(plan.length - 1);
    });

    it("por defecto lleva la foto de la portada", () => {
      const caja = cajaDe(mazo(40, { extras: [CAJA], portadaId: "c7" }));
      expect(caja?.foto).toEqual({ id: "c7", anchoCopia: 2000, recorteAnverso: carta(7, 0).recorteReverso, recorteReverso: carta(7, 0).recorteReverso });
    });

    it("con una carta elegida, lleva esa foto", () => {
      const caja = cajaDe(mazo(40, { extras: [CAJA], portadaId: "c7", caja: { origen: "carta", cartaId: "c12" } }));
      expect(caja?.foto?.id).toBe("c12");
    });

    it("con una foto propia, lleva esa foto con su recorte", () => {
      const caja = cajaDe(mazo(40, { extras: [CAJA], portadaId: "c7", caja: fotoPropia }));
      expect(caja?.foto).toEqual({ id: "caja-1", anchoCopia: 3000, recorteAnverso: fotoPropia.recorte, recorteReverso: fotoPropia.recorte });
    });

    it("sin el extra no se imprime aunque haya foto elegida", () => {
      expect(cajaDe(mazo(40, { caja: fotoPropia }))).toBeUndefined();
    });
  });

  it("cada carta tiene anverso y reverso", () => {
    const plan = planImpresion({ mazo: mazo(40, { extras: [CAJA] }), catalogo, iconos: new Map() });
    expect(plan.every((p) => p.caras[0].cara === "anverso" && p.caras[1].cara === "reverso")).toBe(true);
  });
});
