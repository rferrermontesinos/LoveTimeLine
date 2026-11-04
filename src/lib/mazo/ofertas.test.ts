import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import catalogoJson from "../../../supabase/catalogo.json";
import { cotizar, packsActivos, type Oferta } from "@/domain/precios/cotizar";
import type { Catalogo } from "@/domain/precios/tipos";
import { MENSAJES } from "../../../messages";
import { ofertaPrincipal, textoOferta } from "./ofertas";

const catalogo = catalogoJson as unknown as Catalogo;
const traductores = {
  es: createTranslator({ locale: "es", messages: MENSAJES.es, namespace: "crear" }),
  en: createTranslator({ locale: "en", messages: MENSAJES.en, namespace: "crear" }),
};

/** La frase final, como la ve el cliente (con espacios normales en lugar de los de no separación). */
function frase(o: Oferta, idioma: "es" | "en", detalle = false): string {
  const { clave, valores } = textoOferta(o, "EUR", idioma, detalle);
  return traductores[idioma](`ofertas.${clave}`, valores).replace(/[  ]/g, " ");
}

const oferta = (packId: string, cartas: number, tipo: Oferta["tipo"]): Oferta => {
  const o = cotizar({ catalogo, packId, cartas }).ofertas.find((x) => x.tipo === tipo);
  if (!o) throw new Error(`Sin oferta ${tipo} con ${cartas} cartas en ${packId}`);
  return o;
};

describe("textoOferta", () => {
  it("subir de pack pagando algo más: dice cuánto más y, en el detalle, cuánto menos que sumar las cartas sueltas", () => {
    // 50 cartas en el pequeño: 57 €. Con 10 más, el mediano: 59 €. Sueltas costarían 8 €.
    const o = oferta("pequeno", 50, "subir");
    expect(frase(o, "es")).toBe("Con 10 cartas más pasas al pack Mediano por solo 2 € más.");
    expect(frase(o, "es", true)).toBe("Con 10 cartas más pasas al pack Mediano: pagas solo 2 € más, 6 € menos que si las sumas sueltas.");
    expect(frase(o, "en")).toBe("With 10 more cards you move up to the Medium pack for just €2 more.");
    expect(frase(o, "en", true)).toBe("With 10 more cards you move up to the Medium pack: just €2 more, €6 less than adding them one by one.");
  });

  it("subir de pack pagando menos que ahora o lo mismo", () => {
    // 55 cartas en el pequeño: 61 €. Con 5 más, el mediano cuesta 59 €.
    const menos = oferta("pequeno", 55, "subir");
    expect(frase(menos, "es")).toBe("Con 5 cartas más pasas al pack Mediano y pagas 2 € menos que ahora.");
    expect(frase(menos, "es", true)).toBe(frase(menos, "es"));
    expect(frase(menos, "en")).toBe("With 5 more cards you move up to the Medium pack and pay €2 less than now.");
    const mediano = catalogo.packs.find((p) => p.id === "mediano")!;
    const igual: Oferta = { tipo: "subir", pack: mediano, cartasMas: 1, diferenciaCents: 0, ahorroCents: 80 };
    expect(frase(igual, "es")).toBe("Con 1 carta más pasas al pack Mediano y pagas lo mismo que ahora.");
    expect(frase(igual, "en")).toBe("With 1 more card you move up to the Medium pack and pay the same as now.");
  });

  it("pack mayor ya aplicado: la buena noticia, con lo que se ahorra", () => {
    // 62 cartas: pequeño 66,60 €; mediano 60,40 €.
    const o = oferta("pequeno", 62, "pack-aplicado");
    expect(frase(o, "es")).toBe("Ya te aplicamos el pack Mediano: te ahorras 6,20 €.");
    expect(frase(o, "es", true)).toBe("Con tantas cartas te sale mejor el pack Mediano, así que te lo aplicamos: te ahorras 6,20 €.");
    expect(frase(o, "en")).toBe("We’ve applied the Medium pack: you save €6.20.");
  });

  it("bajar de pack cuando faltan cartas: con qué pack ya se podría pagar y cuánto", () => {
    const o = oferta("mediano", 55, "bajar");
    expect(frase(o, "es")).toBe("Con el pack Pequeño ya podrías pagar (61 €).");
    expect(frase(o, "en")).toBe("With the Small pack you could already check out (€61).");
  });

  it("todas las ofertas posibles tienen su frase completa en los dos idiomas", () => {
    for (const p of packsActivos(catalogo)) {
      for (let n = 1; n <= catalogo.ampliacion.maxCartas; n++) {
        for (const o of cotizar({ catalogo, packId: p.id, cartas: n }).ofertas) {
          for (const idioma of ["es", "en"] as const) {
            for (const detalle of [false, true]) {
              const texto = frase(o, idioma, detalle);
              expect(texto).not.toMatch(/[{}]|undefined|NaN/);
              expect(texto).toContain(o.pack.nombre[idioma]!);
            }
          }
        }
      }
    }
  });
});

describe("ofertaPrincipal", () => {
  it("primero la que propone algo (subir, y si no bajar) y después la buena noticia", () => {
    const subir = oferta("pequeno", 50, "subir");
    const aplicado = oferta("pequeno", 62, "pack-aplicado");
    const bajar = oferta("mediano", 55, "bajar");
    expect(ofertaPrincipal([aplicado, subir])).toBe(subir);
    expect(ofertaPrincipal([aplicado, bajar])).toBe(bajar);
    expect(ofertaPrincipal([aplicado])).toBe(aplicado);
    expect(ofertaPrincipal([])).toBeNull();
  });
});
