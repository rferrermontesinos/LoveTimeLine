import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import { cotizar, ErrorCotizacion, formatearImporte, precioDesde } from "./cotizar";
import type { Catalogo } from "./tipos";

const catalogo = catalogoJson as unknown as Catalogo;

describe("cotizar", () => {
  it("no deja pagar por debajo del mínimo jugable", () => {
    const c = cotizar({ catalogo, packId: "pareja", cartasFoto: 31 });
    expect(c.faltan).toBe(9);
    expect(c.sePuedePagar).toBe(false);
    expect(c.totalCents).toBe(4900);
  });

  it("el pack Pareja básico cuesta 49 € con envío incluido", () => {
    const c = cotizar({ catalogo, packId: "pareja", cartasFoto: 40 });
    expect(c.sePuedePagar).toBe(true);
    expect(c.totalCents).toBe(4900);
    expect(c.lineas.find((l) => l.tipo === "envio")?.importeCents).toBe(0);
    expect(c.huecosLibres).toBe(0);
  });

  it("cobra las cartas que sobran por bloques y cuenta los huecos libres", () => {
    const c = cotizar({ catalogo, packId: "pareja", cartasFoto: 43 });
    expect(c.bloquesAmpliacion).toBe(1);
    expect(c.plazas).toBe(50);
    expect(c.huecosLibres).toBe(7);
    expect(c.totalCents).toBe(4900 + 600);
    const d = cotizar({ catalogo, packId: "familia", cartasFoto: 81 });
    expect(d.bloquesAmpliacion).toBe(3);
    expect(d.totalCents).toBe(5900 + 3 * 600);
  });

  it("suma cajas cuando el mazo no cabe en una", () => {
    const c = cotizar({ catalogo, packId: "familia", cartasFoto: 130, mecanicas: ["comodin", "en-blanco"] });
    // 130 fotos + portada + 2 comodines + 4 en blanco = 137 cartas → 2 cajas
    expect(c.cartasFisicas).toBe(137);
    expect(c.cajas).toBe(2);
    expect(c.lineas.find((l) => l.tipo === "caja")?.importeCents).toBe(500);
  });

  it("las mecánicas no cuestan nada y los extras se suman", () => {
    const c = cotizar({
      catalogo,
      packId: "pareja",
      cartasFoto: 40,
      mecanicas: ["estrella", "cuentalo", "comodin", "en-blanco"],
      extras: ["envoltorio-regalo", "pack-retos"],
    });
    expect(c.totalCents).toBe(4900 + 400 + 600);
    expect(c.cartasFisicas).toBe(40 + 1 + 2 + 4 + 12);
  });

  it("la segunda copia es un porcentaje del mazo", () => {
    const c = cotizar({ catalogo, packId: "pareja", cartasFoto: 50, extras: ["copia-extra"] });
    // mazo = 4900 + 600 = 5500; copia al 60 % = 3300
    expect(c.lineas.find((l) => l.id === "copia-extra")?.importeCents).toBe(3300);
    expect(c.totalCents).toBe(8800);
  });

  it("rechaza packs, extras o mecánicas que no existen", () => {
    expect(() => cotizar({ catalogo, packId: "nada", cartasFoto: 40 })).toThrow(ErrorCotizacion);
    expect(() => cotizar({ catalogo, packId: "pareja", cartasFoto: 40, extras: ["regalo-gratis"] })).toThrow(/extra-desconocido/);
    expect(() => cotizar({ catalogo, packId: "pareja", cartasFoto: -1 })).toThrow(/cartas-invalidas/);
  });

  it("marca los mazos que pasan del máximo", () => {
    const c = cotizar({ catalogo, packId: "familia", cartasFoto: 301 });
    expect(c.excedeMaximo).toBe(true);
    expect(c.sePuedePagar).toBe(false);
  });

  it("formatea importes y el precio desde", () => {
    expect(precioDesde(catalogo)).toEqual({ cents: 4900, moneda: "EUR" });
    expect(formatearImporte(4900, "EUR", "es").replace(/\s/g, " ")).toBe("49 €");
    expect(formatearImporte(4950, "EUR", "en")).toBe("€49.50");
  });
});
