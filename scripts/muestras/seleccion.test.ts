/**
 * Comprueba la selección de fotos de muestra y lo que preparar.ts dejó en public/: que cada
 * archivo existe, mide lo que debe, cabe en su límite, es un JPEG progresivo y no lleva ningún
 * metadato (ni EXIF con la cámara o el GPS, ni XMP, ni IPTC, ni perfil ICC, ni manifiesto C2PA, ni
 * ningún otro segmento APPn fuera de la lista blanca de jpeg.ts), y que los créditos cuadran con la
 * selección. Lee los bytes del JPEG directamente, sin depender de sharp.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRINT } from "../../config/print";
import { leerJpeg, marcadoresDeMetadatos, nombreMarcador } from "./jpeg";
import { medidasSalida } from "./recorte";
import { ALTO_MUESTRA, DESCARTADAS, MAX_BYTES_MUESTRA, MESA, MINI, SALIDAS_MESA, SELECCION } from "./seleccion";

const RAIZ = process.cwd();
const PUBLICO = path.join(RAIZ, "public");
const PROPORCION = PRINT.carta.anchoMm / PRINT.carta.altoMm;

function comprobarArchivo(ruta: string, ancho: number, alto: number, maxBytes: number) {
  const absoluta = path.join(PUBLICO, ruta);
  expect(existsSync(absoluta), ruta).toBe(true);
  const datos = readFileSync(absoluta);
  expect(datos.length, `${ruta} pesa ${datos.length} bytes`).toBeLessThanOrEqual(maxBytes);
  const info = leerJpeg(datos);
  expect({ ancho: info.ancho, alto: info.alto }, ruta).toEqual({ ancho, alto });
  expect(info.progresivo, `${ruta} progresivo`).toBe(true);
  expect(marcadoresDeMetadatos(info.marcadores).map(nombreMarcador), `${ruta} lleva metadatos`).toEqual([]);
  expect(info.terminaBien, `${ruta} lleva algo detrás del final`).toBe(true);
}

interface Creditos {
  fuente: string;
  licencia: { nombre: string; url: string };
  fotos: { id: string; archivos: string[]; fotografo: string; pagina: string; descripcion: { es: string; en: string } }[];
}
const creditos = JSON.parse(readFileSync(path.join(PUBLICO, "muestras", "creditos.json"), "utf8")) as Creditos;

describe("selección de fotos de muestra", () => {
  it("no repite fotos ni ids, y ninguna descartada se usa", () => {
    const ids = [...SELECCION.map((f) => f.id), MESA.id];
    const archivos = [...SELECCION.map((f) => f.archivo), MESA.archivo];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(archivos).size).toBe(archivos.length);
    const descartadas = new Set(DESCARTADAS.map((d) => d.archivo));
    for (const a of archivos) expect(descartadas.has(a), a).toBe(false);
  });

  it("deja fuera las fotos en las que sale alguien que puede ser menor", () => {
    const descartadas = DESCARTADAS.map((d) => d.archivo);
    for (const prefijo of ["06-", "08-", "10-", "12-"]) expect(descartadas.some((a) => a.startsWith(prefijo)), prefijo).toBe(true);
    for (const d of DESCARTADAS) expect(d.motivo.length).toBeGreaterThan(10);
  });

  it("cada foto describe lo que se ve en los dos idiomas", () => {
    for (const f of [...SELECCION, MESA]) {
      expect(f.descripcion.es.trim(), f.id).not.toBe("");
      expect(f.descripcion.en.trim(), f.id).not.toBe("");
    }
  });

  it("los encuadres están dentro de la foto", () => {
    for (const f of SELECCION) {
      const e = f.encuadre ?? {};
      for (const v of [e.centroX, e.centroY]) if (v !== undefined) expect(v >= 0 && v <= 1, f.id).toBe(true);
      if (e.zoom !== undefined) expect(e.zoom, f.id).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("archivos de public/ preparados", () => {
  const grande = medidasSalida(PROPORCION, ALTO_MUESTRA);
  const mini = medidasSalida(PROPORCION, MINI.alto);

  it.each(SELECCION.map((f) => f.id))("%s: grande y ligera, ligeras, progresivas y sin metadatos", (id) => {
    comprobarArchivo(`muestras/${id}.jpg`, grande.ancho, grande.alto, MAX_BYTES_MUESTRA);
    comprobarArchivo(`muestras/${MINI.carpeta}/${id}.jpg`, mini.ancho, mini.alto, MINI.maxBytes);
  });

  it.each(SALIDAS_MESA.map((s) => [s.nombre, s] as const))("mesa %s", (nombre, s) => {
    comprobarArchivo(`juego/${nombre}`, s.ancho, s.alto, s.maxBytes);
  });

  it("no quedan fotos que no salgan de la selección", () => {
    const esperadas = new Set([...SELECCION.map((f) => `${f.id}.jpg`), "creditos.json", MINI.carpeta]);
    expect(readdirSync(path.join(PUBLICO, "muestras")).filter((a) => !esperadas.has(a))).toEqual([]);
    expect(readdirSync(path.join(PUBLICO, "muestras", MINI.carpeta)).sort()).toEqual(SELECCION.map((f) => `${f.id}.jpg`).sort());
    expect(readdirSync(path.join(PUBLICO, "juego")).sort()).toEqual(SALIDAS_MESA.map((s) => s.nombre).sort());
    expect(statSync(path.join(PUBLICO, "muestras", MINI.carpeta)).isDirectory()).toBe(true);
  });
});

describe("créditos publicados", () => {
  it("son de Pexels, con su licencia", () => {
    expect(creditos.fuente).toBe("Pexels");
    expect(creditos.licencia.nombre).toBe("Pexels License");
    expect(creditos.licencia.url).toMatch(/^https:\/\/www\.pexels\.com\//);
  });

  it("hay uno por foto elegida y por la mesa, con autor, página y descripción", () => {
    expect(creditos.fotos.map((f) => f.id)).toEqual([...SELECCION.map((f) => f.id), MESA.id]);
    for (const c of creditos.fotos) {
      expect(c.fotografo.trim(), c.id).not.toBe("");
      expect(c.pagina, c.id).toMatch(/^https:\/\/www\.pexels\.com\/photo\/[\w-]+-\d+\/$/);
      const elegida = [...SELECCION, MESA].find((f) => f.id === c.id)!;
      expect(c.descripcion).toEqual(elegida.descripcion);
      // El número de la página de Pexels es el del archivo original.
      expect(elegida.archivo, c.id).toContain(c.pagina.match(/-(\d+)\/$/)![1]!);
    }
  });

  it("enumeran exactamente los archivos que se publican", () => {
    const porId = new Map(creditos.fotos.map((c) => [c.id, c.archivos]));
    for (const f of SELECCION) expect(porId.get(f.id)).toEqual([`/muestras/${f.id}.jpg`, `/muestras/${MINI.carpeta}/${f.id}.jpg`]);
    expect(porId.get(MESA.id)).toEqual(SALIDAS_MESA.map((s) => `/juego/${s.nombre}`));
  });
});
