import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MUESTRAS } from "@/components/inicio/muestras";
import { compararFechas, filaBienOrdenada, type FechaCarta } from "@/domain/fechas/fecha";
import { SALIDAS_MESA } from "../../../scripts/muestras/seleccion";
import {
  ASOMA_DEBAJO,
  DIAMETRO_MARCA,
  FONDOS,
  FORMATOS,
  MARCAS,
  PIEZAS,
  PROPORCION_CARTA,
  PROPORCION_ESCENA,
  cajaDe,
  lineaEn,
  piezasEn,
  sePisan,
  type Colocacion,
  type ContenidoPieza,
  type FormatoEscena,
  type Papel,
} from "./escena";

type Pieza = ReturnType<typeof piezasEn>[number];
type Punto = { x: number; y: number };

/**
 * Esquinas de una carta girada en unidades de la escena: ancho de la escena = 100 y alto =
 * 100 / proporción (las mismas unidades en los dos ejes, para que el giro no deforme).
 */
function esquinas(c: Colocacion, formato: FormatoEscena): Punto[] {
  const alto = 100 / PROPORCION_ESCENA[formato];
  const cx = c.x;
  const cy = (c.y / 100) * alto;
  const w = c.ancho / 2;
  const h = c.ancho / PROPORCION_CARTA / 2;
  const g = (c.giro * Math.PI) / 180;
  // Giro de CSS: positivo, en el sentido de las agujas del reloj (el eje y va hacia abajo).
  return [
    [-w, -h],
    [w, -h],
    [w, h],
    [-w, h],
  ].map(([x, y]) => ({ x: cx + x! * Math.cos(g) - y! * Math.sin(g), y: cy + x! * Math.sin(g) + y! * Math.cos(g) }));
}

/** ¿Se pisan dos polígonos convexos? (teorema del eje separador). */
function poligonosSePisan(a: Punto[], b: Punto[]): boolean {
  for (const poligono of [a, b]) {
    for (let i = 0; i < poligono.length; i++) {
      const p = poligono[i]!;
      const q = poligono[(i + 1) % poligono.length]!;
      const eje = { x: q.y - p.y, y: p.x - q.x };
      const proyectar = (ps: Punto[]) => ps.map((v) => v.x * eje.x + v.y * eje.y);
      const pa = proyectar(a);
      const pb = proyectar(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

/**
 * La carta de la pieza y las que asoman debajo, colocadas como las pinta MesaPartida: cada una
 * desplazada ASOMA_DEBAJO % de su ancho a la izquierda y la mitad hacia abajo, y algo más girada.
 */
function cartasDe(p: Pieza, formato: FormatoEscena): Colocacion[] {
  const c = p.colocacion;
  const altoEscena = 100 / PROPORCION_ESCENA[formato];
  const w = c.ancho;
  const h = c.ancho / PROPORCION_CARTA;
  const g = (c.giro * Math.PI) / 180;
  const debajo = Array.from({ length: p.debajo ?? 0 }, (_, i) => {
    const dx = (-ASOMA_DEBAJO * (i + 1) * w) / 100;
    const dy = ((ASOMA_DEBAJO * (i + 1)) / 2) * (h / 100);
    const rx = dx * Math.cos(g) - dy * Math.sin(g);
    const ry = dx * Math.sin(g) + dy * Math.cos(g);
    return { x: c.x + rx, y: c.y + (ry / altoEscena) * 100, ancho: w, giro: c.giro - 2.5 * (i + 1) };
  });
  return [c, ...debajo];
}

const piezasSePisan = (a: Pieza, b: Pieza, formato: FormatoEscena) =>
  cartasDe(a, formato).some((ca) => cartasDe(b, formato).some((cb) => poligonosSePisan(esquinas(ca, formato), esquinas(cb, formato))));

function fechaDe(c: ContenidoPieza): FechaCarta {
  if (c.tipo === "muestra") return MUESTRAS[c.clave].fecha;
  if (c.tipo === "texto") return c.fecha;
  throw new Error(`La pieza ${c.tipo} no tiene fecha`);
}

/** Grupos que no se tocan entre sí: las dos personas, la línea, la candidata, el robo y las cartas sueltas. */
function grupoDe(p: Pieza): string {
  if (p.papel === "mano") return p.colocacion.y < 50 ? "mano-arriba" : "mano-abajo";
  if (p.papel === "hueco") return "linea";
  return p.papel;
}

describe.each(FORMATOS)("escena de la mesa, formato %s", (formato) => {
  const piezas = piezasEn(formato);
  const linea = lineaEn(formato);
  const deLinea = linea.filter((p) => p.papel === "linea");
  const candidata = piezas.find((p) => p.papel === "candidata")!;
  const papeles = new Set<Papel>(piezas.map((p) => p.papel));

  it("cuenta todo lo de una partida: línea con hueco, candidata, dos personas, robo, comodín, carta en blanco y un recuerdo de texto", () => {
    for (const papel of ["linea", "hueco", "candidata", "mano", "robo", "comodin", "en-blanco"] as const) expect(papeles.has(papel), papel).toBe(true);
    expect(piezas.filter((p) => p.papel === "candidata")).toHaveLength(1);
    expect(piezas.filter((p) => p.papel === "hueco")).toHaveLength(1);
    expect(deLinea.some((p) => p.contenido.tipo === "texto")).toBe(true);
    const manos = piezas.filter((p) => p.papel === "mano");
    expect(manos.filter((p) => grupoDe(p) === "mano-arriba").length).toBeGreaterThanOrEqual(2);
    expect(manos.filter((p) => grupoDe(p) === "mano-abajo").length).toBeGreaterThanOrEqual(2);
    // La línea va por la cara de la fecha; las manos, el robo y la candidata, por la de la foto.
    for (const p of deLinea) expect(p.contenido).toMatchObject({ cara: "reverso" });
    for (const p of [...manos, candidata, ...piezas.filter((x) => x.papel === "robo")]) expect(p.contenido).toMatchObject({ cara: "anverso" });
  });

  it("no repite la misma carta de muestra", () => {
    const claves = piezas.flatMap((p) => (p.contenido.tipo === "muestra" ? [p.contenido.clave] : []));
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("la línea tiene de 4 a 5 cartas y el hueco no está en una punta", () => {
    expect(deLinea.length).toBeGreaterThanOrEqual(4);
    expect(deLinea.length).toBeLessThanOrEqual(5);
    const i = linea.findIndex((p) => p.papel === "hueco");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(linea.length - 1);
  });

  it("la línea está en orden de fecha, de izquierda a derecha", () => {
    const fechas = deLinea.map((p) => fechaDe(p.contenido));
    for (let i = 1; i < fechas.length; i++) expect(compararFechas(fechas[i - 1]!, fechas[i]!)).toBeLessThan(0);
    expect(filaBienOrdenada(fechas)).toBe(true);
  });

  it("la candidata solo encaja en el hueco", () => {
    const fecha = fechaDe(candidata.contenido);
    const fechas = deLinea.map((p) => fechaDe(p.contenido));
    const hueco = linea.findIndex((p) => p.papel === "hueco");
    for (let posicion = 0; posicion <= fechas.length; posicion++) {
      const fila = [...fechas.slice(0, posicion), fecha, ...fechas.slice(posicion)];
      expect(filaBienOrdenada(fila), `posición ${posicion}`).toBe(posicion === hueco);
    }
  });

  it("todas las cartas, también las que asoman debajo, quedan dentro de la mesa", () => {
    for (const p of piezas) {
      for (const c of cartasDe(p, formato)) {
        const caja = cajaDe(c, formato);
        expect(caja.x0, p.id).toBeGreaterThanOrEqual(0);
        expect(caja.y0, p.id).toBeGreaterThanOrEqual(0);
        expect(caja.x1, p.id).toBeLessThanOrEqual(100);
        expect(caja.y1, p.id).toBeLessThanOrEqual(100);
      }
    }
  });

  it("la candidata está sobre el hueco y no pisa las cartas de al lado", () => {
    const hueco = linea.find((p) => p.papel === "hueco")!;
    expect(piezasSePisan(candidata, hueco, formato)).toBe(true);
    expect(sePisan(cajaDe(candidata.colocacion, formato), cajaDe(hueco.colocacion, formato))).toBe(true);
    for (const p of deLinea) expect(piezasSePisan(candidata, p, formato), p.id).toBe(false);
    expect(Math.abs(candidata.colocacion.x - hueco.colocacion.x)).toBeLessThan(1);
    expect(candidata.colocacion.y).toBeLessThan(hueco.colocacion.y);
    expect(candidata.capa).toBe(Math.max(...piezas.map((p) => p.capa)));
  });

  it("los grupos no se pisan entre sí, ni las cartas de la línea entre ellas", () => {
    for (const [i, a] of piezas.entries()) {
      for (const b of piezas.slice(i + 1)) {
        const mismoGrupo = grupoDe(a) === grupoDe(b);
        const candidataYHueco = new Set([a.papel, b.papel]).size === 2 && [a.papel, b.papel].every((x) => x === "candidata" || x === "hueco");
        if ((mismoGrupo && grupoDe(a) !== "linea") || candidataYHueco) continue;
        expect(piezasSePisan(a, b, formato), `${a.id} y ${b.id}`).toBe(false);
      }
    }
  });

  it("los números caben en la mesa y no tapan ninguna carta", () => {
    const altoEscena = 100 / PROPORCION_ESCENA[formato];
    const r = DIAMETRO_MARCA[formato] / 2;
    for (const m of MARCAS) {
      const { x, y } = m.en[formato];
      const cy = (y / 100) * altoEscena;
      // El cuadrado que contiene el círculo: si no toca una carta, el círculo tampoco.
      const cuadrado = [
        { x: x - r, y: cy - r },
        { x: x + r, y: cy - r },
        { x: x + r, y: cy + r },
        { x: x - r, y: cy + r },
      ];
      expect(x - r, `marca ${m.numero}`).toBeGreaterThanOrEqual(0);
      expect(x + r, `marca ${m.numero}`).toBeLessThanOrEqual(100);
      expect(cy - r, `marca ${m.numero}`).toBeGreaterThanOrEqual(0);
      expect(cy + r, `marca ${m.numero}`).toBeLessThanOrEqual(altoEscena);
      for (const p of piezas) {
        for (const c of cartasDe(p, formato)) expect(poligonosSePisan(cuadrado, esquinas(c, formato)), `marca ${m.numero} y ${p.id}`).toBe(false);
      }
    }
  });

  it("cada número señala piezas que salen en este formato", () => {
    for (const m of MARCAS) for (const papel of m.papeles) expect(papeles.has(papel), `marca ${m.numero}: ${papel}`).toBe(true);
  });
});

describe("leyenda de la escena", () => {
  it("numera del 1 al 6 sin repetir y cubre todo lo que hay en la mesa", () => {
    expect(MARCAS.map((m) => m.numero)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(MARCAS.map((m) => m.clave)).size).toBe(MARCAS.length);
    const senalados = new Set(MARCAS.flatMap((m) => m.papeles));
    for (const p of PIEZAS) expect(senalados.has(p.papel), p.id).toBe(true);
  });

  it("todas las piezas salen al menos en un formato y los ids no se repiten", () => {
    expect(new Set(PIEZAS.map((p) => p.id)).size).toBe(PIEZAS.length);
    for (const p of PIEZAS) expect(Object.keys(p.en).length, p.id).toBeGreaterThan(0);
  });
});

describe("fondos de la escena", () => {
  const raiz = process.cwd();

  it("cada formato tiene su foto en public/juego, con la forma de la escena", () => {
    const salidas = new Map(SALIDAS_MESA.map((s) => [`/juego/${s.nombre}`, s]));
    for (const f of FORMATOS) {
      const salida = salidas.get(FONDOS[f]);
      expect(salida, f).toBeDefined();
      expect(PROPORCION_ESCENA[f]).toBeCloseTo(salida!.ancho / salida!.alto, 6);
      expect(existsSync(path.join(raiz, "public", FONDOS[f])), FONDOS[f]).toBe(true);
    }
  });

  it("el estilo usa las mismas medidas que la composición", () => {
    const css = readFileSync(path.join(raiz, "src", "components", "juego", "MesaPartida.module.css"), "utf8");
    // Proporción de cada formato (vertical: 3 / 4; apaisada: 16 / 10) y diámetro de los números.
    expect(PROPORCION_ESCENA.vertical).toBe(3 / 4);
    expect(PROPORCION_ESCENA.apaisada).toBe(16 / 10);
    expect(css).toContain("aspect-ratio: 3 / 4;");
    expect(css).toContain("aspect-ratio: 16 / 10;");
    expect(css).toContain(`width: ${DIAMETRO_MARCA.vertical}%;`);
    expect(css).toContain(`width: ${DIAMETRO_MARCA.apaisada}%;`);
  });
});
