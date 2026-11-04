import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import { cotizar } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import type { Carta, Mazo } from "@/lib/mazo/tipos";
import { cartasImpresas, planImpresion } from "./plan";

const catalogo = catalogoJson as unknown as Catalogo;

const carta = (i: number, anio: number | null): Carta => ({
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
  version: 1,
  id: "m",
  creadoEn: 0,
  actualizadoEn: 0,
  packId: "pareja",
  estiloId: "pareja",
  tintaId: "rosa",
  titulo: "Laura y Marc",
  dedicatoria: "",
  portadaId: null,
  tono: "original",
  idiomaMazo: "es",
  mecanicas: ["estrella", "cuentalo", "comodin", "en-blanco"],
  extras: [],
  consentimientoFotos: 1,
  paso: 4,
  // Años al revés para comprobar que el plan las ordena.
  cartas: Array.from({ length: n }, (_, i) => carta(i, 2025 - i)),
  pedido: null,
  ...cambios,
});

const retos = Array.from({ length: 12 }, (_, i) => `Reto ${i + 1}`);

describe("plan de impresión", () => {
  it("imprime tantas cartas como cobra la cotización", () => {
    for (const [m, extras] of [
      [mazo(40), []],
      [mazo(47), ["pack-retos"]],
      [mazo(40, { mecanicas: [] }), []],
    ] as const) {
      const conExtras = { ...m, extras: [...extras] };
      const plan = planImpresion({ mazo: conExtras, catalogo, iconos: new Map(), retos });
      const c = cotizar({ catalogo, packId: conExtras.packId, cartasFoto: conExtras.cartas.length, extras: conExtras.extras, mecanicas: conExtras.mecanicas });
      expect(cartasImpresas(plan)).toBe(c.cartasFisicas);
    }
  });

  it("empieza por la portada, sigue el orden cronológico y acaba con la caja", () => {
    const plan = planImpresion({ mazo: mazo(42), catalogo, iconos: new Map(), retos });
    expect(plan[0]?.clave).toBe("portada");
    expect(plan.at(-1)?.clave).toBe("caja");
    const anios = plan.filter((p) => p.tipo === "foto").map((p) => p.caras[0].datos.fecha?.anio ?? 0);
    expect(anios).toEqual([...anios].sort((a, b) => a - b));
    expect(plan.filter((p) => p.tipo === "comodin")).toHaveLength(2);
    expect(plan.filter((p) => p.tipo === "en-blanco")).toHaveLength(4);
    expect(plan.filter((p) => p.tipo === "reto")).toHaveLength(0);
  });

  it("los retos llevan su texto y la portada usa la foto elegida", () => {
    const m = mazo(40, { extras: ["pack-retos"], portadaId: "c7" });
    const plan = planImpresion({ mazo: m, catalogo, iconos: new Map([["c3", "estrella"]]), retos });
    const textos = plan.filter((p) => p.tipo === "reto").map((p) => p.caras[1].datos.texto);
    expect(textos).toEqual(retos);
    expect(plan[0]?.foto?.id).toBe("c7");
    expect(plan.find((p) => p.clave === "foto-c3")?.caras[0].datos.icono).toBe("estrella");
  });

  it("cada carta tiene anverso y reverso", () => {
    const plan = planImpresion({ mazo: mazo(40), catalogo, iconos: new Map(), retos });
    expect(plan.every((p) => p.caras[0].cara === "anverso" && p.caras[1].cara === "reverso")).toBe(true);
  });
});
