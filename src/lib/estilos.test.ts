import { describe, expect, it } from "vitest";
import { PRINT } from "@config/print";
import catalogoJson from "../../supabase/catalogo.json";
import { CONTRASTE_GRAFICO, CONTRASTE_TEXTO, contraste } from "@/domain/color/contraste";
import type { Catalogo } from "@/domain/precios/tipos";
import { ESTILOS, ESTILO_POR_DEFECTO, colorGlifo, obtenerPaleta, obtenerPlantilla, rutaIcono, superficie } from "./estilos";

const catalogo = catalogoJson as unknown as Catalogo;

describe("estilos y paletas", () => {
  it("los ids de estilos y de paletas no se repiten", () => {
    expect(new Set(ESTILOS.map((e) => e.id)).size).toBe(ESTILOS.length);
    for (const e of ESTILOS) expect(new Set(e.paletas.map((p) => p.id)).size).toBe(e.paletas.length);
  });

  it("la paleta por defecto existe y es la que se usa si no se elige otra", () => {
    for (const e of ESTILOS) {
      expect(e.paletas.some((p) => p.id === e.paletaPorDefecto)).toBe(true);
      expect(obtenerPaleta(e, null).id).toBe(e.paletaPorDefecto);
      expect(obtenerPaleta(e, "no-existe").id).toBe(e.paletaPorDefecto);
    }
    expect(ESTILOS).toContain(ESTILO_POR_DEFECTO);
  });

  for (const estilo of ESTILOS) {
    for (const p of estilo.paletas) {
      describe(`${estilo.id} · ${p.id}`, () => {
        it(`el texto se lee sobre el fondo (≥ ${CONTRASTE_TEXTO}:1)`, () => {
          expect(contraste(p.texto, p.fondo)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO);
        });

        it(`el icono se distingue del hueco de tinta (≥ ${CONTRASTE_GRAFICO}:1)`, () => {
          expect(contraste(colorGlifo(p, estilo.colores), estilo.colores.tinta)).toBeGreaterThanOrEqual(CONTRASTE_GRAFICO);
        });

        it("las caras sin foto no usan el color de la pestaña y se leen bien", () => {
          const s = superficie(p, estilo.colores);
          expect(contraste(p.fondo, s.fondo)).toBeGreaterThanOrEqual(CONTRASTE_GRAFICO);
          expect(contraste(s.texto, s.fondo)).toBeGreaterThanOrEqual(CONTRASTE_TEXTO);
          expect(contraste(s.acento, s.fondo)).toBeGreaterThanOrEqual(CONTRASTE_GRAFICO);
        });
      });
    }
  }

  it("la paleta «noche» (pestaña de tinta) pasa a papel en el icono y en las caras sin foto", () => {
    const e = ESTILO_POR_DEFECTO;
    const noche = e.paletas.find((p) => p.fondo.toLowerCase() === e.colores.tinta.toLowerCase());
    if (!noche) return;
    expect(colorGlifo(noche, e.colores)).toBe(e.colores.papel);
    expect(superficie(noche, e.colores).fondo).toBe(e.colores.papel);
  });
});

describe("plantillas", () => {
  const plantillas = [...new Set(ESTILOS.map((e) => e.plantilla))].map(obtenerPlantilla);

  it("tienen el icono de cada mecánica activa del catálogo", () => {
    const iconos = catalogo.mecanicas.filter((m) => m.activo && m.icono).map((m) => m.icono!);
    expect(iconos.length).toBeGreaterThan(0);
    for (const p of plantillas) for (const i of iconos) expect(rutaIcono(p, i), `${p.id}: ${i}`).not.toBeNull();
  });

  it("cada icono es una ruta SVG válida con una regla de relleno conocida", () => {
    for (const p of plantillas) {
      for (const [id, def] of Object.entries(p.iconos)) {
        const ruta = rutaIcono(p, id)!;
        expect(ruta.d, id).toMatch(/^[Mm][\d\s.,\-MmLlHhVvCcSsQqTtAaZz]+$/);
        if (typeof def !== "string" && def.regla) expect(["nonzero", "evenodd"]).toContain(def.regla);
      }
    }
  });

  it("un icono desconocido o vacío no se dibuja", () => {
    const p = obtenerPlantilla(ESTILO_POR_DEFECTO.plantilla);
    expect(rutaIcono(p, "no-existe")).toBeNull();
    expect(rutaIcono(p, null)).toBeNull();
    expect(rutaIcono(p, "")).toBeNull();
  });

  it("los textos ajustables tienen un mínimo por debajo del máximo y una alineación válida", () => {
    for (const p of plantillas) {
      for (const t of [p.texto.anverso, p.texto.reverso, p.portada.titulo, p.portada.dedicatoria, p.caja.generica.nombre, p.comodin.reverso.regla]) {
        expect(t.tamanoMinimo).toBeGreaterThan(0);
        expect(t.tamanoMinimo).toBeLessThanOrEqual(t.tamanoMaximo);
        expect(t.lineasMaximas).toBeGreaterThanOrEqual(1);
      }
      for (const t of [p.texto.anverso, p.texto.reverso]) expect(["centro", "abajo"]).toContain(t.alineacion);
    }
  });

  // Sin estos números, el ajuste de texto calcula alturas NaN y recorta el texto con «…».
  it("las zonas de texto tienen interlineado y sus cuatro lados, como números, y dejan sitio", () => {
    const { anchoMm, altoMm } = PRINT.carta;
    for (const p of plantillas) {
      const zonas = [
        { nombre: "texto.anverso", t: p.texto.anverso, alto: altoMm },
        { nombre: "texto.reverso", t: p.texto.reverso, alto: p.reverso.altoFoto },
        { nombre: "caja.generica.nombre", t: p.caja.generica.nombre, alto: altoMm },
      ];
      for (const { nombre, t, alto } of zonas) {
        expect(Number.isFinite(t.interlineado), `${nombre}.interlineado`).toBe(true);
        expect(t.interlineado).toBeGreaterThan(0);
        for (const lado of ["izquierda", "derecha", "arriba", "abajo"] as const) {
          expect(Number.isFinite(t.zona[lado]), `${nombre}.zona.${lado}`).toBe(true);
          expect(t.zona[lado], `${nombre}.zona.${lado}`).toBeGreaterThanOrEqual(0);
        }
        expect(t.zona.izquierda + t.zona.derecha, `${nombre}: ancho`).toBeLessThan(anchoMm);
        expect(t.zona.arriba + t.zona.abajo, `${nombre}: alto`).toBeLessThan(alto);
      }
    }
  });

  it("una plantilla desconocida es un error", () => {
    expect(() => obtenerPlantilla("no-existe")).toThrow(/Plantilla desconocida/);
  });
});
