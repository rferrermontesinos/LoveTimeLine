import { describe, expect, it } from "vitest";
import { MAX_DEDICATORIA } from "@/domain/mazo/validar";
import { obtenerPlantilla } from "@/lib/estilos";
import { dedicatoriaRecortada } from "./dibujar";

/** Un contexto que mide cada letra como media letra de alto: lo justo para partir líneas. */
const ctx = { font: "", measureText: (t: string) => ({ width: [...t].length * 50 }) } as unknown as CanvasRenderingContext2D;
const plantilla = obtenerPlantilla("naipe");

describe("dedicatoriaRecortada", () => {
  it("vacía o corta, cabe", () => {
    expect(dedicatoriaRecortada(ctx, plantilla, "")).toBe(false);
    expect(dedicatoriaRecortada(ctx, plantilla, "  \n ")).toBe(false);
    expect(dedicatoriaRecortada(ctx, plantilla, "Para Ana y Leo, con todo nuestro cariño.")).toBe(false);
  });

  it("todo el largo permitido en un párrafo cabe", () => {
    const larga = "Que cada carta os recuerde lo bien que lo pasamos juntos, los viajes, las risas y todo lo que aún nos queda por vivir. Os quiero mucho, Ana";
    expect([...larga].length).toBeLessThanOrEqual(MAX_DEDICATORIA);
    expect(dedicatoriaRecortada(ctx, plantilla, larga)).toBe(false);
  });

  it("con más líneas de las que caben en la tarjeta, se cortaría", () => {
    const firmas = ["Con amor,", "Papá", "Mamá", "La abuela Rosa", "El tío Marc", "Los primos", "Tita", "Laia", "Pau", "Jan", "Nil"].join("\n");
    expect([...firmas].length).toBeLessThanOrEqual(MAX_DEDICATORIA);
    expect(dedicatoriaRecortada(ctx, plantilla, firmas)).toBe(true);
    // Con una línea menos, entra.
    expect(dedicatoriaRecortada(ctx, plantilla, firmas.split("\n").slice(0, plantilla.portada.dedicatoria.lineasMaximas).join("\n"))).toBe(false);
  });
});
