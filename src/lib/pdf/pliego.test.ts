import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, type PDFPage } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { IMPRENTAS, PLIEGO_PNP_SORIANO as H, PRINT, paginaImprenta } from "@config/print";
import { cartasPorHoja, codigoTrabajo, hojasNecesarias, lineasDeCorte, montarPliegos, posicionEnPliego, recorteDesdeDiseno, rectCelda, rectRejilla } from "./pliego";

// Medidas del PDF que generó PNP Tool 20.9.10 con el estilo «Copisteria Soriano › Carta Estandar»
// (24-11-2026), leídas de su contenido: en mm desde arriba a la izquierda y en pt como en el PDF.
const PNP = {
  celdasX: [4.75, 72.25, 139.75],
  celdasY: [10.15, 103.05, 195.95],
  cortesX: [5.75, 69.25, 73.25, 136.75, 140.75, 204.25],
  cortesY: [11.15, 100.05, 104.05, 192.95, 196.95, 285.85],
  imagenesPt: { x: [13.46, 204.8, 396.14], y: [555.45, 292.11, 28.77], ancho: 185.67, alto: 257.67 },
  horizontalesPt: { y: [31.61, 283.61, 294.94, 546.94, 558.28, 810.28], hasta: 13.3, desde: 581.98 },
  verticalesPt: { x: [16.3, 196.3, 207.64, 387.64, 398.98, 578.98], hasta: 28.61, desde: 813.28 },
  numeroPt: { x: 295.41, y: 17.71 },
  codigoPt: { x: 34.17, y: 13.54 },
};

describe("la hoja de PNP Tool (Soriano)", () => {
  it("las cartas y los cortes caen donde los pone el programa", () => {
    for (const [f, y] of PNP.celdasY.entries())
      for (const [c, x] of PNP.celdasX.entries()) {
        const r = rectCelda(H, f, c);
        expect(r.x).toBeCloseTo(x, 6);
        expect(r.y).toBeCloseTo(y, 6);
        expect(r.ancho).toBeCloseTo(65.5, 6);
        expect(r.alto).toBeCloseTo(90.9, 6);
      }
    const cortes = lineasDeCorte(H);
    cortes.x.forEach((x, i) => expect(x).toBeCloseTo(PNP.cortesX[i]!, 6));
    cortes.y.forEach((y, i) => expect(y).toBeCloseTo(PNP.cortesY[i]!, 6));
  });

  it("la rejilla queda centrada en el A4", () => {
    const r = rectRejilla(H);
    expect(r.x).toBeCloseTo(H.papel.anchoMm - r.x - r.ancho, 6);
    expect(r.y).toBeCloseTo(H.papel.altoMm - r.y - r.alto, 6);
  });

  it("llena por filas y, en la trasera, con las columnas al revés", () => {
    expect(cartasPorHoja(H)).toBe(9);
    expect(posicionEnPliego(H, 0, "anverso")).toEqual({ hoja: 0, fila: 0, columna: 0 });
    expect(posicionEnPliego(H, 0, "reverso")).toEqual({ hoja: 0, fila: 0, columna: 2 });
    expect(posicionEnPliego(H, 5, "anverso")).toEqual({ hoja: 0, fila: 1, columna: 2 });
    expect(posicionEnPliego(H, 5, "reverso")).toEqual({ hoja: 0, fila: 1, columna: 0 });
    expect(posicionEnPliego(H, 9, "anverso")).toEqual({ hoja: 1, fila: 0, columna: 0 });
    expect(hojasNecesarias(H, 45)).toBe(5);
    expect(hojasNecesarias(H, 46)).toBe(6);
  });

  it("la carta de la hoja sale de la cara dibujada sin escalar: lo que pasa de 63 × 88 es sangrado del diseño", () => {
    const r = recorteDesdeDiseno(H);
    expect(r.xMm).toBeCloseTo((PRINT.carta.anchoMm + 2 * PRINT.sangradoMm - 65.5) / 2, 6);
    expect(r.yMm).toBeCloseTo((PRINT.carta.altoMm + 2 * PRINT.sangradoMm - 90.9) / 2, 6);
    expect(() => recorteDesdeDiseno({ ...H, corte: { anchoMm: 70, altoMm: 95 } })).toThrow(/no cabe/);
  });

  it("el código del trabajo, como el del programa: prefijo y fecha y hora hasta los milisegundos", () => {
    expect(codigoTrabajo("SO", new Date(2026, 10, 24, 13, 50, 58, 983))).toBe("SO20261124135058983");
    expect(codigoTrabajo("SO", new Date(2027, 0, 2, 3, 4, 5, 6))).toBe("SO20270102030405006");
  });

  it("el perfil de Soriano usa esta hoja; la página es el A4", () => {
    const soriano = IMPRENTAS.find((p) => p.id === "soriano")!;
    expect(soriano).toMatchObject({ paginas: "pliegos", pliego: H, sangradoMm: 1 });
    expect(paginaImprenta(soriano)).toMatchObject({ ancho: 210, alto: 297, margen: 0, cara: { ancho: 65.5, alto: 90.9 } });
  });
});

/** Lo que dibuja una página: imágenes, líneas y textos, en puntos, leídos de su contenido. */
function leerPagina(pdf: PDFDocument, p: PDFPage) {
  const c = p.node.Contents();
  const streams = c instanceof PDFArray ? c.asArray().map((r) => pdf.context.lookup(r)) : [c];
  const texto = streams
    .map((s) => {
      const raw = s as PDFRawStream;
      return Buffer.from(raw.dict.get(PDFName.of("Filter")) ? inflateSync(raw.contents) : raw.contents).toString("latin1");
    })
    .join("\n");
  const imagenes: { x: number; y: number; ancho: number; alto: number }[] = [];
  const lineas: { x1: number; y1: number; x2: number; y2: number; grosor: number }[] = [];
  const textos: { x: number; y: number; texto: string }[] = [];
  let pila: string[] = [];
  // Solo traslados y escalas, que es lo que usa pdf-lib para dibujar imágenes; q y Q guardan y recuperan.
  let traslado = [0, 0];
  let escala = [1, 1];
  const guardados: { traslado: number[]; escala: number[] }[] = [];
  let grosor = 1;
  let desde = [0, 0];
  let posTexto = [0, 0];
  for (const t of texto.split(/\s+/).filter(Boolean)) {
    const n = pila.map(Number);
    if (t === "cm") {
      traslado = [traslado[0]! + escala[0]! * n[4]!, traslado[1]! + escala[1]! * n[5]!];
      escala = [escala[0]! * n[0]!, escala[1]! * n[3]!];
    } else if (t === "Do") imagenes.push({ x: traslado[0]!, y: traslado[1]!, ancho: escala[0]!, alto: escala[1]! });
    else if (t === "w") grosor = n[0]!;
    else if (t === "m") desde = [n[0]!, n[1]!];
    else if (t === "l") lineas.push({ x1: desde[0]!, y1: desde[1]!, x2: n[0]!, y2: n[1]!, grosor });
    else if (t === "Tm") posTexto = [n[4]!, n[5]!];
    else if (t === "Tj") {
      const hex = pila[0]!.replace(/[<>]/g, "");
      textos.push({ x: posTexto[0]!, y: posTexto[1]!, texto: Buffer.from(hex, "hex").toString("latin1") });
    } else if (t === "q") guardados.push({ traslado, escala });
    else if (t === "Q") ({ traslado, escala } = guardados.pop() ?? { traslado: [0, 0], escala: [1, 1] });
    if (/^[a-zA-Z*'"]+$/.test(t)) pila = [];
    else pila.push(t);
  }
  return { imagenes, lineas, textos };
}

// Un PNG de 1 × 1 píxeles: para montar la hoja basta con cualquier imagen.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

describe("montarPliegos", () => {
  it("cada hoja seguida de su trasera, con todo donde lo pone PNP Tool", async () => {
    const pdf = await PDFDocument.create();
    const img = await pdf.embedPng(PNG);
    const piezas = 10;
    await montarPliegos(pdf, H, Array(piezas).fill(img), Array(piezas).fill(img), "SO20261124135058983");
    const guardado = await PDFDocument.load(await pdf.save());
    expect(guardado.getPageCount()).toBe(4);
    for (const p of guardado.getPages()) {
      expect(p.getWidth()).toBeCloseTo(595.28, 2);
      expect(p.getHeight()).toBeCloseTo(841.89, 2);
    }

    const hoja1 = leerPagina(guardado, guardado.getPage(0));
    // Las 9 cartas, con su sangrado.
    expect(hoja1.imagenes.filter((i) => i.ancho > 100)).toHaveLength(9);
    for (const i of hoja1.imagenes.filter((i) => i.ancho > 100)) {
      expect(PNP.imagenesPt.x.some((x) => Math.abs(x - i.x) < 0.01)).toBe(true);
      expect(PNP.imagenesPt.y.some((y) => Math.abs(y - i.y) < 0.01)).toBe(true);
      expect(i.ancho).toBeCloseTo(PNP.imagenesPt.ancho, 2);
      expect(i.alto).toBeCloseTo(PNP.imagenesPt.alto, 2);
    }
    // Líneas de corte de 1 pt, del borde del papel hasta la rejilla.
    const cortes = hoja1.lineas.filter((l) => l.grosor === 1);
    expect(cortes).toHaveLength(24);
    for (const y of PNP.horizontalesPt.y) {
      expect(cortes.some((l) => Math.abs(l.y1 - y) < 0.01 && l.x1 === 0 && Math.abs(l.x2 - PNP.horizontalesPt.hasta) < 0.01)).toBe(true);
      expect(cortes.some((l) => Math.abs(l.y1 - y) < 0.01 && Math.abs(l.x1 - PNP.horizontalesPt.desde) < 0.01 && Math.abs(l.x2 - 595.28) < 0.01)).toBe(true);
    }
    for (const x of PNP.verticalesPt.x) {
      expect(cortes.some((l) => Math.abs(l.x1 - x) < 0.01 && l.y1 === 0 && Math.abs(l.y2 - PNP.verticalesPt.hasta) < 0.01)).toBe(true);
      expect(cortes.some((l) => Math.abs(l.x1 - x) < 0.01 && Math.abs(l.y1 - PNP.verticalesPt.desde) < 0.01 && Math.abs(l.y2 - 841.89) < 0.01)).toBe(true);
    }
    // Número de hoja centrado y código del trabajo abajo a la izquierda.
    const numero = hoja1.textos.find((t) => t.texto === "1")!;
    expect(numero.x).toBeCloseTo(PNP.numeroPt.x, 1);
    expect(numero.y).toBeCloseTo(PNP.numeroPt.y, 2);
    const codigo = hoja1.textos.find((t) => t.texto === "SO20261124135058983")!;
    expect(codigo.x).toBeCloseTo(PNP.codigoPt.x, 2);
    expect(codigo.y).toBeCloseTo(PNP.codigoPt.y, 2);

    // La trasera de la hoja 1 es «1B»; la segunda hoja lleva la carta 10 sola, y su trasera en la columna de la derecha.
    expect(leerPagina(guardado, guardado.getPage(1)).textos.map((t) => t.texto)).toContain("1B");
    const hoja2 = leerPagina(guardado, guardado.getPage(2)).imagenes.filter((i) => i.ancho > 100);
    const trasera2 = leerPagina(guardado, guardado.getPage(3)).imagenes.filter((i) => i.ancho > 100);
    expect(hoja2).toHaveLength(1);
    expect(hoja2[0]!.x).toBeCloseTo(PNP.imagenesPt.x[0]!, 2);
    expect(trasera2[0]!.x).toBeCloseTo(PNP.imagenesPt.x[2]!, 2);
    expect(trasera2[0]!.y).toBeCloseTo(PNP.imagenesPt.y[0]!, 2);
  });

  it("la única letra es Helvetica, como en el PDF del programa", async () => {
    const pdf = await PDFDocument.create();
    const img = await pdf.embedPng(PNG);
    await montarPliegos(pdf, H, [img], [img], "SO1");
    // pdf-lib escribe las letras al guardar: se mira el archivo guardado.
    const guardado = await PDFDocument.load(await pdf.save());
    const fuentes = guardado.context
      .enumerateIndirectObjects()
      .map(([, o]) => o)
      .filter((o): o is PDFDict => o instanceof PDFDict && o.get(PDFName.of("Type")) === PDFName.of("Font"))
      .map((o) => String(o.get(PDFName.of("BaseFont"))));
    expect(fuentes).toEqual(["/Helvetica"]);
  });

  it("no monta caras sin su reverso", async () => {
    const pdf = await PDFDocument.create();
    const img = await pdf.embedPng(PNG);
    await expect(montarPliegos(pdf, H, [img, img], [img], "SO1")).rejects.toThrow(/reverso/);
  });
});
