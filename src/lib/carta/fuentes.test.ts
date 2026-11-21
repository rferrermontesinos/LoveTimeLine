import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plantilla } from "@/lib/estilos";

const plantilla = {
  fuentes: {
    titular: { familia: "Prueba Titular", url: "/fonts/cartas/titular.woff2", peso: 800 },
    texto: { familia: "Prueba Texto", url: "/fonts/cartas/texto.woff2", peso: 400 },
  },
} as unknown as Plantilla;

/** Lo que el navegador falso ha pedido y lo que ha añadido al documento. */
let pedidas: string[];
let anadidas: string[];
/** Archivos que fallan al pedirlos (sin conexión). */
let fallan: Set<string>;

class FontFaceFalsa {
  constructor(
    readonly familia: string,
    readonly origen: string,
  ) {}
  async load() {
    pedidas.push(this.origen);
    await Promise.resolve();
    if ([...fallan].some((u) => this.origen.includes(u))) throw new Error("sin conexión");
    return this;
  }
}

/** Módulo nuevo en cada prueba: lo cargado vive en el propio módulo. */
const cargar = () => import("./fuentes");

beforeEach(() => {
  vi.resetModules();
  pedidas = [];
  anadidas = [];
  fallan = new Set();
  vi.stubGlobal("FontFace", FontFaceFalsa);
  vi.stubGlobal("document", { fonts: { add: (c: FontFaceFalsa) => anadidas.push(c.origen) } });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fuentes de las cartas", () => {
  it("las carga una sola vez", async () => {
    const { cargarFuentesCartas, fuentesCartasCargadas } = await cargar();
    await cargarFuentesCartas(plantilla);
    await cargarFuentesCartas(plantilla);
    expect(pedidas).toHaveLength(2);
    expect(anadidas).toHaveLength(2);
    expect(fuentesCartasCargadas(plantilla)).toBe(true);
  });

  it("quien las pide mientras se cargan espera a la misma carga", async () => {
    const { cargarFuentesCartas } = await cargar();
    await Promise.all([cargarFuentesCartas(plantilla), cargarFuentesCartas(plantilla), cargarFuentesCartas(plantilla)]);
    expect(pedidas).toHaveLength(2);
  });

  it("si una falla no rompe el dibujo y la siguiente vez se reintenta solo la que falta", async () => {
    const { cargarFuentesCartas, fuentesCartasCargadas } = await cargar();
    fallan.add("titular");
    await expect(cargarFuentesCartas(plantilla)).resolves.toBeUndefined();
    expect(fuentesCartasCargadas(plantilla)).toBe(false);
    expect(anadidas).toEqual(["url(/fonts/cartas/texto.woff2)"]);

    // Vuelve la conexión.
    fallan.clear();
    await cargarFuentesCartas(plantilla);
    expect(fuentesCartasCargadas(plantilla)).toBe(true);
    expect(pedidas).toEqual(["url(/fonts/cartas/titular.woff2)", "url(/fonts/cartas/texto.woff2)", "url(/fonts/cartas/titular.woff2)"]);
  });

  it("en el servidor no hace nada", async () => {
    vi.unstubAllGlobals();
    const { cargarFuentesCartas, fuentesCartasCargadas } = await cargar();
    await expect(cargarFuentesCartas(plantilla)).resolves.toBeUndefined();
    expect(fuentesCartasCargadas(plantilla)).toBe(false);
  });
});
