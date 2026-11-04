import { describe, expect, it } from "vitest";
import catalogoJson from "../../../supabase/catalogo.json";
import { cotizar, ErrorCotizacion, formatearImporte, normalizarSeleccion, packPorDefecto, packsActivos, precioDesde, type Oferta } from "./cotizar";
import type { Catalogo } from "./tipos";

const catalogo = catalogoJson as unknown as Catalogo;
const oferta = (o: Oferta[], tipo: Oferta["tipo"]) => o.find((x) => x.tipo === tipo);

describe("cotizar: packs por tamaño", () => {
  it("hay tres packs activos, de menor a mayor, y el pequeño es el de por defecto", () => {
    expect(packsActivos(catalogo).map((p) => [p.id, p.cartas, p.precioCents])).toEqual([
      ["pequeno", 40, 4900],
      ["mediano", 60, 5900],
      ["grande", 100, 7900],
    ]);
    expect(packPorDefecto(catalogo)?.id).toBe("pequeno");
  });

  it("no deja pagar por debajo del mínimo del pack elegido", () => {
    const c = cotizar({ catalogo, packId: "pequeno", cartas: 31 });
    expect(c.faltan).toBe(9);
    expect(c.sePuedePagar).toBe(false);
    expect(c.totalCents).toBe(4900);
    expect(c.ofertas).toEqual([]);
  });

  it("el pack pequeño cuesta 49 € con envío incluido", () => {
    const c = cotizar({ catalogo, packId: "pequeno", cartas: 40 });
    expect(c.sePuedePagar).toBe(true);
    expect(c.totalCents).toBe(4900);
    expect(c.cartasExtra).toBe(0);
    expect(c.lineas.find((l) => l.tipo === "envio")?.importeCents).toBe(0);
    expect(c.ofertas).toEqual([]);
  });

  it("cobra cada carta que pasa del pack, una a una", () => {
    const c = cotizar({ catalogo, packId: "pequeno", cartas: 45 });
    expect(c.cartasExtra).toBe(5);
    expect(c.precioCartaExtraCents).toBe(80);
    expect(c.lineas.find((l) => l.tipo === "cartas-extra")).toEqual({ tipo: "cartas-extra", id: "cartas-extra", cantidad: 5, importeCents: 400 });
    expect(c.totalCents).toBe(5300);
    const g = cotizar({ catalogo, packId: "grande", cartas: 103 });
    expect(g.totalCents).toBe(7900 + 3 * 60);
  });
});

describe("cotizar: ofertas", () => {
  it("cerca del pack siguiente avisa de que sumar cartas sale a cuenta aunque se pague algo más", () => {
    // 50 cartas en el pequeño: 49 + 10 × 0,80 = 57 €. El mediano (60 cartas) cuesta 59 €.
    const c = cotizar({ catalogo, packId: "pequeno", cartas: 50 });
    expect(c.totalCents).toBe(5700);
    expect(oferta(c.ofertas, "subir")).toMatchObject({ pack: { id: "mediano" }, cartasMas: 10, diferenciaCents: 200, ahorroCents: 600 });
  });

  it("lejos del pack siguiente no molesta con ofertas", () => {
    const c = cotizar({ catalogo, packId: "pequeno", cartas: 49 });
    expect(c.ofertas).toEqual([]);
  });

  it("nunca se paga más que el pack siguiente: se cobra ese y dice cuántas cartas caben aún", () => {
    // 55 cartas en el pequeño serían 61 €; el mediano (60 cartas) cuesta 59 €: se cobra ese.
    const c = cotizar({ catalogo, packId: "pequeno", cartas: 55 });
    expect(c.pack.id).toBe("pequeno");
    expect(c.packAplicado.id).toBe("mediano");
    expect(c.totalCents).toBe(5900);
    expect(c.cartasExtra).toBe(0);
    expect(c.minimo).toBe(40);
    expect(c.sePuedePagar).toBe(true);
    // Se imprimen las 55 y la portada: los 5 huecos no salen en blanco.
    expect(c.cartasFisicas).toBe(56);
    expect(c.ofertas).toEqual([expect.objectContaining({ tipo: "pack-aplicado", pack: expect.objectContaining({ id: "mediano" }), ahorroCents: 200, huecos: 5 })]);
    // Desde 53 cartas (59,40 € sueltas) ya compensa.
    expect(cotizar({ catalogo, packId: "pequeno", cartas: 52 }).packAplicado.id).toBe("pequeno");
    expect(oferta(cotizar({ catalogo, packId: "pequeno", cartas: 53 }).ofertas, "pack-aplicado")).toMatchObject({ ahorroCents: 40, huecos: 7 });
    // Mediano con 89 cartas serían 79,30 €; el grande cuesta 79 €.
    const m = cotizar({ catalogo, packId: "mediano", cartas: 89 });
    expect(m.totalCents).toBe(7900);
    expect(oferta(m.ofertas, "pack-aplicado")).toMatchObject({ pack: { id: "grande" }, ahorroCents: 30, huecos: 11 });
  });

  it("cobra solo el pack mayor cuando ya está cubierto y sale más barato", () => {
    // 62 cartas: pequeño 49 + 22 × 0,80 = 66,60 €; mediano 59 + 2 × 0,70 = 60,40 €.
    const c = cotizar({ catalogo, packId: "pequeno", cartas: 62 });
    expect(c.pack.id).toBe("pequeno");
    expect(c.packAplicado.id).toBe("mediano");
    expect(c.totalCents).toBe(6040);
    expect(c.minimo).toBe(40);
    expect(oferta(c.ofertas, "pack-aplicado")).toMatchObject({ pack: { id: "mediano" }, ahorroCents: 620, huecos: 0 });
    // 100 cartas en el pequeño: el grande (79 €) es lo más barato.
    expect(cotizar({ catalogo, packId: "pequeno", cartas: 100 }).packAplicado.id).toBe("grande");
  });

  it("si faltan cartas para el pack elegido, ofrece el menor que ya está cubierto", () => {
    const c = cotizar({ catalogo, packId: "mediano", cartas: 55 });
    expect(c.faltan).toBe(5);
    expect(c.sePuedePagar).toBe(false);
    expect(oferta(c.ofertas, "bajar")).toMatchObject({ pack: { id: "pequeno" }, totalCents: 6100 });
  });

  it("nunca cobra más que con el pack elegido, ni más que un pack mayor, y el precio no baja al sumar cartas", () => {
    const mecanicas = catalogo.mecanicas.filter((m) => m.activo && m.porDefecto).map((m) => m.id);
    for (const conMecanicas of [[], mecanicas]) {
      for (const p of packsActivos(catalogo)) {
        let anterior = 0;
        for (let n = p.cartas; n <= catalogo.ampliacion.maxCartas; n++) {
          const c = cotizar({ catalogo, packId: p.id, cartas: n, mecanicas: conMecanicas });
          if (conMecanicas.length === 0) {
            const cajasExtra = Math.ceil((n + 1) / catalogo.caja.capacidadCartas) - 1;
            const sinCambio = p.precioCents + (n - p.cartas) * p.precioCartaExtraCents + cajasExtra * catalogo.caja.precioCajaExtraCents;
            expect(c.totalCents).toBeLessThanOrEqual(sinCambio);
            expect(c.cartasFisicas).toBe(n + 1);
          }
          for (const q of packsActivos(catalogo).filter((q) => q.cartas >= n && q.cartas > p.cartas)) {
            expect(c.totalCents).toBeLessThanOrEqual(cotizar({ catalogo, packId: q.id, cartas: q.cartas, mecanicas: conMecanicas }).totalCents);
          }
          expect(c.totalCents).toBeGreaterThanOrEqual(anterior);
          anterior = c.totalCents;
          const s = oferta(c.ofertas, "subir");
          if (s && s.tipo === "subir") expect(s.ahorroCents).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("cotizar: cajas, mecánicas y extras", () => {
  it("suma cajas cuando el mazo no cabe en una", () => {
    const c = cotizar({ catalogo, packId: "grande", cartas: 114, mecanicas: ["comodin", "en-blanco"] });
    // 114 recuerdos + portada + 2 comodines + 4 en blanco = 121 cartas → 2 cajas
    expect(c.cartasFisicas).toBe(121);
    expect(c.cajas).toBe(2);
    expect(c.lineas.find((l) => l.tipo === "caja")?.importeCents).toBe(500);
  });

  it("las mecánicas no cuestan nada y los extras se suman", () => {
    const c = cotizar({
      catalogo,
      packId: "pequeno",
      cartas: 40,
      mecanicas: ["estrella", "comodin", "en-blanco"],
      extras: ["envoltorio-regalo", "caja-personalizada"],
    });
    expect(c.totalCents).toBe(4900 + 400 + 700);
    expect(c.cartasFisicas).toBe(40 + 1 + 2 + 4);
  });

  it("la segunda copia es un porcentaje del mazo", () => {
    const c = cotizar({ catalogo, packId: "pequeno", cartas: 50, extras: ["copia-extra"] });
    // mazo = 4900 + 10 × 80 = 5700; copia al 60 % = 3420
    expect(c.lineas.find((l) => l.id === "copia-extra")?.importeCents).toBe(3420);
    expect(c.totalCents).toBe(9120);
  });

  it("rechaza packs, extras o mecánicas que no existen o ya no se ofrecen", () => {
    expect(() => cotizar({ catalogo, packId: "nada", cartas: 40 })).toThrow(ErrorCotizacion);
    expect(() => cotizar({ catalogo, packId: "pareja", cartas: 40 })).toThrow(/pack-desconocido/);
    expect(() => cotizar({ catalogo, packId: "pequeno", cartas: 40, extras: ["pack-retos"] })).toThrow(/extra-desconocido/);
    expect(() => cotizar({ catalogo, packId: "pequeno", cartas: 40, mecanicas: ["cuentalo"] })).toThrow(/mecanica-desconocida/);
    expect(() => cotizar({ catalogo, packId: "pequeno", cartas: -1 })).toThrow(/cartas-invalidas/);
  });

  it("marca los mazos que pasan del máximo", () => {
    const c = cotizar({ catalogo, packId: "grande", cartas: 301 });
    expect(c.excedeMaximo).toBe(true);
    expect(c.sePuedePagar).toBe(false);
  });
});

describe("selección y formato", () => {
  it("normaliza la selección de un borrador antiguo", () => {
    expect(
      normalizarSeleccion({ packId: "pareja", extras: ["pack-retos", "envoltorio-regalo"], mecanicas: ["cuentalo", "estrella"] }, catalogo),
    ).toEqual({ packId: "pequeno", extras: ["envoltorio-regalo"], mecanicas: ["estrella"], cambiado: true });
    expect(normalizarSeleccion({ packId: "grande", extras: [], mecanicas: ["comodin"] }, catalogo).cambiado).toBe(false);
  });

  it("formatea importes y el precio desde", () => {
    expect(precioDesde(catalogo)).toEqual({ cents: 4900, moneda: "EUR" });
    expect(formatearImporte(4900, "EUR", "es").replace(/\s/g, " ")).toBe("49 €");
    expect(formatearImporte(4950, "EUR", "en")).toBe("€49.50");
  });
});
