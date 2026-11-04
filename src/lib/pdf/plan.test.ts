import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import { cotizar } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import { nuevaCartaTexto } from "@/lib/mazo/derivados";
import type { Carta, CartaFoto, Mazo } from "@/lib/mazo/tipos";
import { cartasImpresas, planImpresion } from "./plan";

const catalogo = catalogoJson as unknown as Catalogo;

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

const retos = Array.from({ length: 12 }, (_, i) => `Reto ${i + 1}`);

describe("plan de impresión", () => {
  it("imprime tantas cartas como cobra la cotización", () => {
    const conTexto = mazo(38);
    conTexto.cartas.push(nuevaCartaTexto("t1", "El día que nos conocimos", { anio: 2012 }, 0), nuevaCartaTexto("t2", "Nuestra boda", { anio: 2016, mes: 6 }, 0));
    for (const [m, extras] of [
      [mazo(40), []],
      [mazo(47), ["envoltorio-regalo", "copia-extra"]],
      [mazo(40, { mecanicas: [] }), []],
      [conTexto, []],
    ] as const) {
      const conExtras = { ...m, extras: [...extras] };
      const plan = planImpresion({ mazo: conExtras, catalogo, iconos: new Map(), retos });
      const c = cotizar({ catalogo, packId: conExtras.packId, cartas: conExtras.cartas.length, extras: conExtras.extras, mecanicas: conExtras.mecanicas });
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

  it("la portada usa la foto elegida y un extra retirado no imprime cartas", () => {
    const m = mazo(40, { extras: ["pack-retos"], portadaId: "c7" });
    const plan = planImpresion({ mazo: m, catalogo, iconos: new Map([["c3", "estrella"]]), retos });
    expect(plan.filter((p) => p.tipo === "reto")).toHaveLength(0);
    expect(plan[0]?.foto?.id).toBe("c7");
    expect(plan.find((p) => p.clave === "foto-c3")?.caras[0].datos.icono).toBe("estrella");
  });

  it("una carta de texto entra en su sitio de la línea del tiempo, sin foto", () => {
    const m = mazo(40);
    m.cartas.push(nuevaCartaTexto("t1", "El día que nos conocimos", { anio: 1980 }, 0));
    const plan = planImpresion({ mazo: m, catalogo, iconos: new Map(), retos });
    // Es el recuerdo más antiguo: va justo después de la portada.
    const primera = plan[1];
    expect(primera?.foto).toBeNull();
    expect(primera?.caras[1].datos.tipo).toBe("texto");
    expect(primera?.caras[1].datos.texto).toBe("El día que nos conocimos");
  });

  it("cada carta tiene anverso y reverso", () => {
    const plan = planImpresion({ mazo: mazo(40), catalogo, iconos: new Map(), retos });
    expect(plan.every((p) => p.caras[0].cara === "anverso" && p.caras[1].cara === "reverso")).toBe(true);
  });
});
