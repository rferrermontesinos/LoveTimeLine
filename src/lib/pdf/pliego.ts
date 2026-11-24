/**
 * Hojas con varias cartas, montadas como las monta el programa de la imprenta (config/print.ts,
 * PliegoImprenta). Hoy es la hoja A4 de PNP Tool que usa Soriano: la geometría, las líneas de corte,
 * las dianas, la tira de color, el código del trabajo y el número de hoja salen del PDF que genera el
 * programa. Solo se dejan fuera sus logotipos (el del programa en la tira y el de la imprenta junto
 * al código): son marcas ajenas. El número y el código van en Helvetica sin incrustar, como en el PDF
 * del programa: es el archivo que la imprenta espera (las páginas de una carta no llevan ninguna
 * fuente, ver `rotuloPagina` en imprimir.ts).
 *
 * La geometría no dibuja nada, para poder probarla sin navegador; `montarPliegos` coloca en las
 * hojas las caras ya incrustadas en el PDF.
 */
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { MM_POR_PULGADA, PRINT, type PliegoImprenta } from "@config/print";
import type { Cara } from "@/lib/carta/tipos";

const PT_POR_MM = 72 / MM_POR_PULGADA;
const pt = (mm: number) => mm * PT_POR_MM;

/** Un rectángulo en milímetros, desde la esquina de arriba a la izquierda del papel. */
export interface RectMm {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** La carta con su sangrado. */
export function celdaMm(h: PliegoImprenta) {
  return { ancho: h.corte.anchoMm + 2 * h.sangradoMm, alto: h.corte.altoMm + 2 * h.sangradoMm };
}

/** Dónde va la carta de una fila y una columna de la hoja, con su sangrado. */
export function rectCelda(h: PliegoImprenta, fila: number, columna: number): RectMm {
  const c = celdaMm(h);
  return { x: h.origenMm.x + columna * (c.ancho + h.separacionMm), y: h.origenMm.y + fila * (c.alto + h.separacionMm), ...c };
}

/** Todas las cartas de la hoja juntas, con su sangrado. */
export function rectRejilla(h: PliegoImprenta): RectMm {
  const primera = rectCelda(h, 0, 0);
  const ultima = rectCelda(h, h.filas - 1, h.columnas - 1);
  return { x: primera.x, y: primera.y, ancho: ultima.x + ultima.ancho - primera.x, alto: ultima.y + ultima.alto - primera.y };
}

/** Las líneas de corte de la hoja: la izquierda y la derecha de cada columna, y la de arriba y la de abajo de cada fila. */
export function lineasDeCorte(h: PliegoImprenta): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let c = 0; c < h.columnas; c++) {
    const r = rectCelda(h, 0, c);
    x.push(r.x + h.sangradoMm, r.x + r.ancho - h.sangradoMm);
  }
  for (let f = 0; f < h.filas; f++) {
    const r = rectCelda(h, f, 0);
    y.push(r.y + h.sangradoMm, r.y + r.alto - h.sangradoMm);
  }
  return { x, y };
}

/** Cartas por hoja. */
export function cartasPorHoja(h: PliegoImprenta): number {
  return h.columnas * h.filas;
}

/** Hojas que hacen falta para un número de piezas (cada hoja, con su trasera). */
export function hojasNecesarias(h: PliegoImprenta, piezas: number): number {
  return Math.ceil(piezas / cartasPorHoja(h));
}

/**
 * Hoja, fila y columna de una pieza del plan. Las piezas llenan la hoja por filas, de izquierda a
 * derecha; en la trasera, las columnas van al revés, para que al darle la vuelta por el lado largo
 * cada reverso caiga detrás de su cara.
 */
export function posicionEnPliego(h: PliegoImprenta, indice: number, cara: Cara) {
  const porHoja = cartasPorHoja(h);
  const hoja = Math.floor(indice / porHoja);
  const enHoja = indice % porHoja;
  const fila = Math.floor(enHoja / h.columnas);
  const columna = enHoja % h.columnas;
  return { hoja, fila, columna: cara === "anverso" ? columna : h.columnas - 1 - columna };
}

/**
 * Cuánto se quita de cada lado de la cara dibujada (la carta del diseño con su sangrado) para que
 * quede la celda de la hoja: el corte de la imprenta y su sangrado, sin escalar. Si el corte es algo
 * mayor que la carta diseñada, esa diferencia sale del sangrado del diseño.
 */
export function recorteDesdeDiseno(h: PliegoImprenta): { xMm: number; yMm: number } {
  const c = celdaMm(h);
  const xMm = (PRINT.carta.anchoMm + 2 * PRINT.sangradoMm - c.ancho) / 2;
  const yMm = (PRINT.carta.altoMm + 2 * PRINT.sangradoMm - c.alto) / 2;
  if (xMm < 0 || yMm < 0) throw new Error(`La celda de la hoja (${c.ancho} × ${c.alto} mm) no cabe en la cara dibujada con su sangrado`);
  return { xMm, yMm };
}

/** Código del trabajo como el del programa: prefijo y fecha y hora local hasta los milisegundos. */
export function codigoTrabajo(prefijo: string, fecha: Date): string {
  const d = (n: number, cifras = 2) => String(n).padStart(cifras, "0");
  return (
    prefijo +
    d(fecha.getFullYear(), 4) +
    d(fecha.getMonth() + 1) +
    d(fecha.getDate()) +
    d(fecha.getHours()) +
    d(fecha.getMinutes()) +
    d(fecha.getSeconds()) +
    d(fecha.getMilliseconds(), 3)
  );
}

const NEGRO = rgb(0, 0, 0);

/**
 * Diana de registro: dos aros, el centro relleno y la cruz de lado a lado, dentro de un cuadrado de
 * `lado` puntos con la esquina de abajo a la izquierda en (x, y).
 */
function diana(p: PDFPage, x: number, y: number, lado: number) {
  const cx = x + lado / 2;
  const cy = y + lado / 2;
  const u = lado / 10;
  p.drawLine({ start: { x, y: cy }, end: { x: x + lado, y: cy }, thickness: 0.3 * u, color: NEGRO });
  p.drawLine({ start: { x: cx, y }, end: { x: cx, y: y + lado }, thickness: 0.3 * u, color: NEGRO });
  p.drawCircle({ x: cx, y: cy, size: 3.9 * u, borderWidth: 0.7 * u, borderColor: NEGRO });
  p.drawCircle({ x: cx, y: cy, size: 2.5 * u, borderWidth: 0.7 * u, borderColor: NEGRO });
  p.drawCircle({ x: cx, y: cy, size: 1.3 * u, color: NEGRO });
}

const rgb255 = (r: number, g: number, b: number) => rgb(r / 255, g / 255, b / 255);

/**
 * Las tintas de la tira de PNP Tool: cian, magenta, amarillo y negro al 100, 75, 50 y 25 %, con los
 * colores RGB que lleva su tira.
 */
const TINTAS = [
  [rgb255(0, 159, 227), rgb255(0, 177, 235), rgb255(89, 198, 242), rgb255(161, 218, 247)],
  [rgb255(230, 0, 126), rgb255(234, 81, 152), rgb255(240, 135, 182), rgb255(245, 181, 211)],
  [rgb255(255, 237, 0), rgb255(255, 240, 63), rgb255(255, 243, 129), rgb255(255, 247, 178)],
  [rgb255(0, 0, 0), rgb255(87, 86, 86), rgb255(135, 135, 134), rgb255(179, 178, 178)],
];

/** Los dos negros de la tira: el de la diana y el parche K, y el del cuadro y su cruz. */
const NEGRO_TIRA = rgb255(35, 31, 32);
const MARCO_TIRA = rgb255(48, 42, 43);

/**
 * Tira de control de color de PNP Tool, redibujada con las medidas de su imagen de 200 × 15 pt
 * (en pt desde la esquina de arriba a la izquierda de la tira): una diana a la izquierda, las cuatro
 * tintas en cuatro grupos y, a la derecha, un cuadro con los cuatro colores y su cruz. La imagen
 * del programa está estirada a lo ancho, y por eso la diana es algo ovalada. El hueco del logotipo
 * del programa queda en blanco.
 */
function tiraColor(p: PDFPage, x: number, y: number, h: PliegoImprenta) {
  const kx = h.tiraColor.anchoPt / 200;
  const ky = h.tiraColor.altoPt / 15;
  const arriba = y + h.tiraColor.altoPt;
  const caja = (x0: number, y0: number, x1: number, y1: number, color: RGB) =>
    p.drawRectangle({ x: x + x0 * kx, y: arriba - y1 * ky, width: (x1 - x0) * kx, height: (y1 - y0) * ky, color });

  // Diana: dos aros, el centro relleno con la cruz en blanco y la cruz en negro por fuera. Su imagen
  // mide 90 × 90 píxeles dentro de 16,23 × 15 pt: un píxel son 1/5,545 pt a lo ancho y 1/6 de alto.
  const [px, py] = [16.23 / 90, 15 / 90];
  const cx = 45 * px;
  const cy = 44.5 * py;
  const ovalo = (radio: number, relleno: boolean) =>
    p.drawEllipse({
      x: x + cx * kx,
      y: arriba - cy * ky,
      xScale: radio * px * kx,
      yScale: radio * py * ky,
      ...(relleno ? { color: NEGRO_TIRA } : { borderColor: NEGRO_TIRA, borderWidth: 4 * py * ky }),
    });
  const cruz = (desde: number, hasta: number, color: RGB) => {
    caja(cx - hasta * px, cy - 2 * py, cx - desde * px, cy + 2 * py, color);
    caja(cx + desde * px, cy - 2 * py, cx + hasta * px, cy + 2 * py, color);
    caja(cx - 2 * px, cy - hasta * py, cx + 2 * px, cy - desde * py, color);
    caja(cx - 2 * px, cy + desde * py, cx + 2 * px, cy + hasta * py, color);
  };
  ovalo(34, false);
  ovalo(25.5, false);
  cruz(17.5, 44.5, NEGRO_TIRA);
  ovalo(17.5, true);
  cruz(0, 17.5, rgb(1, 1, 1));

  // Cuatro grupos de cuatro parches seguidos de 6,31 pt, cada grupo 32,64 pt más a la derecha.
  TINTAS.forEach((grupo, g) => grupo.forEach((color, i) => caja(57.35 + 32.64 * g + 6.31 * i, 3.67, 57.35 + 32.64 * g + 6.31 * (i + 1), 11.33, color)));

  // Cuadro de la derecha: la cruz de lado a lado, el marco y, dentro, los cuatro colores sobre blanco.
  caja(185.21, 7.333, 200, 7.667, MARCO_TIRA);
  caja(192.25, 0.667, 192.79, 14.333, MARCO_TIRA);
  caja(186.11, 1.667, 198.92, 2.833, MARCO_TIRA);
  caja(186.11, 12.2, 198.92, 13.5, MARCO_TIRA);
  caja(186.11, 1.667, 187.37, 13.5, MARCO_TIRA);
  caja(197.5, 1.667, 198.92, 13.5, MARCO_TIRA);
  caja(188.64, 3.833, 196.39, 11, rgb(1, 1, 1));
  caja(188.64, 3.833, 192.43, 7.333, rgb255(31, 171, 226));
  caja(192.79, 3.833, 196.39, 7.333, rgb255(227, 27, 133));
  caja(188.64, 7.667, 192.43, 11, NEGRO_TIRA);
  caja(192.79, 7.667, 196.39, 11, rgb255(245, 233, 41));
}

/**
 * Monta las hojas en el PDF: cada hoja con sus caras y, detrás, su trasera. `caras` y `reversos`
 * van en el orden del plan, ya incrustados y recortados a la celda (carta de corte y sangrado).
 */
export async function montarPliegos(pdf: PDFDocument, h: PliegoImprenta, caras: PDFImage[], reversos: PDFImage[], codigo: string) {
  if (caras.length !== reversos.length) throw new Error("Cada cara necesita su reverso");
  const letra = await pdf.embedFont(StandardFonts.Helvetica);
  const W = pt(h.papel.anchoMm);
  const H = pt(h.papel.altoMm);
  const rejilla = rectRejilla(h);
  const cortes = lineasDeCorte(h);
  const { grosorPt, holguraPt } = h.lineasCorte;

  for (let hoja = 0; hoja < hojasNecesarias(h, caras.length); hoja++) {
    for (const cara of ["anverso", "reverso"] as const) {
      const p = pdf.addPage([W, H]);
      // Dianas en las cuatro esquinas.
      for (const [x, y] of [
        [0, 0],
        [W - h.dianaPt, 0],
        [W - h.dianaPt, H - h.dianaPt],
        [0, H - h.dianaPt],
      ] as const)
        diana(p, x, y, h.dianaPt);
      // Número de hoja, centrado.
      const numero = `${hoja + 1}${cara === "reverso" ? h.numero.sufijoTrasera : ""}`;
      p.drawText(numero, { x: W / 2 - letra.widthOfTextAtSize(numero, h.letraPt) / 2, y: h.numero.yPt, size: h.letraPt, font: letra, color: NEGRO });
      // La tira de color, solo en la primera hoja.
      if (hoja === 0 && cara === "anverso") tiraColor(p, (W - h.tiraColor.anchoPt) / 2, H - h.tiraColor.altoPt, h);

      // Las cartas.
      const imagenes = cara === "anverso" ? caras : reversos;
      imagenes.forEach((imagen, indice) => {
        const pos = posicionEnPliego(h, indice, cara);
        if (pos.hoja !== hoja) return;
        const r = rectCelda(h, pos.fila, pos.columna);
        p.drawImage(imagen, { x: pt(r.x), y: H - pt(r.y + r.alto), width: pt(r.ancho), height: pt(r.alto) });
      });

      // Líneas de corte: del borde del papel hasta casi tocar la rejilla.
      const trazo = (x1: number, y1: number, x2: number, y2: number) =>
        p.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: grosorPt, color: NEGRO });
      const izquierda = pt(rejilla.x) - holguraPt;
      const derecha = pt(rejilla.x + rejilla.ancho) + holguraPt;
      const abajo = H - pt(rejilla.y + rejilla.alto) - holguraPt;
      const arriba = H - pt(rejilla.y) + holguraPt;
      for (const y of cortes.y) {
        trazo(0, H - pt(y), izquierda, H - pt(y));
        trazo(derecha, H - pt(y), W, H - pt(y));
      }
      for (const x of cortes.x) {
        trazo(pt(x), 0, pt(x), abajo);
        trazo(pt(x), arriba, pt(x), H);
      }

      // Código del trabajo, abajo a la izquierda.
      p.drawText(codigo, { x: h.codigo.xPt, y: h.codigo.yPt, size: h.letraPt, font: letra, color: NEGRO });
    }
  }
}
