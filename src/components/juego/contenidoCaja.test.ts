import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import catalogoJson from "../../../supabase/catalogo.json";
import type { Catalogo, Mecanica } from "@/domain/precios/tipos";
import { MENSAJES } from "../../../messages";
import { cartasEspeciales, textoContenidoCaja, type TraducirCaja } from "./contenidoCaja";

const catalogo = catalogoJson as unknown as Catalogo;
const traductor = (idioma: "es" | "en"): TraducirCaja => {
  const t = createTranslator({ locale: idioma, messages: MENSAJES[idioma], namespace: "juego.contenidoCaja" });
  return (clave, valores) => t(clave, valores);
};
const texto = (mecanicas: Mecanica[], idioma: "es" | "en") => textoContenidoCaja(mecanicas, idioma, traductor(idioma));

/** El catálogo con una mecánica cambiada. */
const con = (id: string, cambios: Partial<Mecanica>): Mecanica[] => catalogo.mecanicas.map((m) => (m.id === id ? { ...m, ...cambios } : m));
const cartasDe = (id: string) => catalogo.mecanicas.find((m) => m.id === id)!.cartasFisicas!;

describe("cartasEspeciales", () => {
  it("salen del catálogo: comodines y cartas en blanco, con sus cartas", () => {
    expect(cartasEspeciales(catalogo.mecanicas)).toEqual([
      { clave: "comodines", n: cartasDe("comodin") },
      { clave: "enBlanco", n: cartasDe("en-blanco") },
    ]);
  });

  it("una mecánica retirada, sin cartas o que no está no sale", () => {
    expect(cartasEspeciales(con("comodin", { activo: false })).map((e) => e.clave)).toEqual(["enBlanco"]);
    expect(cartasEspeciales(con("en-blanco", { cartasFisicas: 0 })).map((e) => e.clave)).toEqual(["comodines"]);
    expect(cartasEspeciales(catalogo.mecanicas.filter((m) => m.id !== "comodin" && m.id !== "en-blanco"))).toEqual([]);
  });
});

describe("textoContenidoCaja", () => {
  it("dice las cantidades del catálogo, en cada idioma", () => {
    const comodines = cartasDe("comodin");
    const enBlanco = cartasDe("en-blanco");
    expect(texto(catalogo.mecanicas, "es")).toBe(
      `Vuestras cartas de recuerdos, la portada y las cartas especiales que elijáis: ${comodines} comodines y ${enBlanco} cartas en blanco. También un folleto con estas reglas.`,
    );
    expect(texto(catalogo.mecanicas, "en")).toBe(
      `Your memory cards, the cover card and the special cards you choose: ${comodines} jokers and ${enBlanco} blank cards. Plus a leaflet with these rules.`,
    );
  });

  it("si el catálogo cambia, el texto cambia con él (y concuerda en singular)", () => {
    expect(texto(con("comodin", { cartasFisicas: 1 }), "es")).toContain(`: 1 comodín y ${cartasDe("en-blanco")} cartas en blanco.`);
    expect(texto(con("en-blanco", { cartasFisicas: 6 }), "en")).toContain(`: ${cartasDe("comodin")} jokers and 6 blank cards.`);
    expect(texto(con("comodin", { activo: false }), "es")).toContain(`que elijáis: ${cartasDe("en-blanco")} cartas en blanco.`);
    expect(texto(con("en-blanco", { activo: false, cartasFisicas: 1 }), "en")).toContain(`you choose: ${cartasDe("comodin")} jokers.`);
  });

  it("sin cartas especiales activas, no las nombra", () => {
    const sin = con("comodin", { activo: false }).map((m) => (m.id === "en-blanco" ? { ...m, activo: false } : m));
    expect(texto(sin, "es")).toBe("Vuestras cartas de recuerdos y la portada. También un folleto con estas reglas.");
    expect(texto(sin, "en")).toBe("Your memory cards and the cover card. Plus a leaflet with these rules.");
  });
});
