/**
 * Archivos de impresión del mazo, generados en el navegador con el mismo dibujante que la vista previa.
 *
 * Cada cara es una página: la cara con sangrado rasterizada a 300 ppp (JPEG) y las cajas TrimBox y
 * BleedBox para la imprenta. Cada imprenta (config/print.ts, IMPRENTAS) pide su sangrado, sus marcas
 * de corte y su reparto: un PDF con cada carta seguida de su reverso o, en un ZIP, un PDF con las
 * caras y otro con los reversos. Las cartas van en el orden del plan (ver plan.ts): la caja solo si
 * es la personalizada.
 */
import { PDFDocument, rgb } from "pdf-lib";
import { BRAND_NAME } from "@config/brand";
import { MM_POR_PULGADA, PRINT, paginaImprenta, type PerfilImprenta } from "@config/print";
import { dibujarCara, medidasCara } from "@/lib/carta/dibujar";
import { asegurarFuentesCartas } from "@/lib/carta/fuentes";
import { textosCarta } from "@/lib/carta/textos";
import type { DatosCarta } from "@/lib/carta/tipos";
import { obtenerEstilo, obtenerPlantilla, obtenerPaleta, type Tono } from "@/lib/estilos";
import { crearLienzo, type LienzoTrabajo } from "@/lib/importar/lienzo";
import { cartasImpresas, type CartaPlan } from "./plan";
import { crearZip } from "./zip";

export interface FotoParaImprimir {
  imagen: CanvasImageSource;
  ancho: number;
  cerrar?: () => void;
}

export interface EntradaPdf {
  plan: CartaPlan[];
  estiloId: string;
  paletaId: string;
  tono: Tono;
  idiomaMazo: string;
  titulo: string;
  /**
   * Devuelve la foto a la mejor resolución disponible (la copia de trabajo). La foto propia de
   * la caja personalizada está en el mismo almacén que las de las cartas, con su id.
   */
  obtenerFoto: (id: string) => Promise<FotoParaImprimir | null>;
  alProgresar?: (hechas: number, total: number) => void;
}

const PT_POR_MM = 72 / MM_POR_PULGADA;
const pt = (mm: number) => mm * PT_POR_MM;

/** Un archivo listo para descargar: un PDF o, si la imprenta quiere las caras aparte, un ZIP. */
export interface ArchivoImpresion {
  nombre: string;
  bytes: Uint8Array;
  tipo: "application/pdf" | "application/zip";
}

/** Lo que dice la nota que acompaña a los PDF en el ZIP. */
export interface DatosLeeme {
  titulo: string;
  cartas: number;
  paginas: number;
  caras: string;
  reversos: string;
  /** La última página de cada PDF es la caja personalizada. */
  caja: "si" | "no";
}

/**
 * Cuánto cambia el borde de cada cara al pasar del sangrado del diseño al de la imprenta, en
 * píxeles por lado: positivo, se amplía en espejo; negativo, se recorta.
 */
export function ajusteSangrado(p: { anchoPx: number; altoPx: number; pxPorMm: number; disenoMm: number; imprentaMm: number }) {
  const cambioPx = Math.round((p.imprentaMm - p.disenoMm) * p.pxPorMm);
  // El espejo solo copia sangrado: nunca lo que queda dentro de la carta.
  if (p.imprentaMm < 0 || p.imprentaMm - p.disenoMm > p.disenoMm) throw new Error(`Sangrado fuera de rango: ${p.imprentaMm} mm`);
  return { cambioPx, anchoPx: p.anchoPx + 2 * cambioPx, altoPx: p.altoPx + 2 * cambioPx };
}

/**
 * Copia la cara de `origen` en `destino` con el borde ajustado: si `cambio` es positivo, la amplía
 * por cada lado reflejando el borde (como «añadir sangrado por reflexión» de los programas de
 * maquetación); si es negativo, recorta.
 */
function ajustarBorde(origen: LienzoTrabajo, destino: LienzoTrabajo, cambio: number) {
  const ctx = destino.ctx;
  const w = origen.canvas.width;
  const h = origen.canvas.height;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (cambio < 0) {
    const c = -cambio;
    ctx.drawImage(origen.canvas, c, c, w - 2 * c, h - 2 * c, 0, 0, w - 2 * c, h - 2 * c);
    ctx.restore();
    return;
  }
  const e = cambio;
  const W = w + 2 * e;
  ctx.clearRect(0, 0, W, h + 2 * e);
  ctx.drawImage(origen.canvas, e, e);
  // Izquierda y derecha, reflejando las columnas del borde.
  ctx.setTransform(-1, 0, 0, 1, 2 * e, 0);
  ctx.drawImage(origen.canvas, 0, 0, e, h, e, e, e, h);
  ctx.setTransform(-1, 0, 0, 1, 2 * (e + w), 0);
  ctx.drawImage(origen.canvas, w - e, 0, e, h, w, e, e, h);
  // Arriba y abajo, con las esquinas: se reflejan las filas del lienzo ya ampliado a lo ancho.
  ctx.setTransform(1, 0, 0, -1, 0, 2 * e);
  ctx.drawImage(destino.canvas, 0, e, W, e, 0, e, W, e);
  ctx.setTransform(1, 0, 0, -1, 0, 2 * (e + h));
  ctx.drawImage(destino.canvas, 0, h, W, e, 0, h, W, e);
  ctx.restore();
}

/** La cara en JPEG; si la imprenta pone un límite por página, baja la calidad hasta que quepa. */
async function aJpeg(l: LienzoTrabajo, maxBytes: number | null): Promise<Uint8Array> {
  // Margen para lo que la página añade al JPEG (cajas, marcas, texto).
  const limite = maxBytes === null ? Infinity : maxBytes - 16_000;
  let bytes = new Uint8Array();
  for (const calidad of [PRINT.calidadJpeg, 0.85, 0.78, 0.7, 0.6]) {
    bytes = new Uint8Array(await (await l.aBlob("image/jpeg", calidad)).arrayBuffer());
    if (bytes.length <= limite) break;
  }
  return bytes;
}

async function nuevoPdf(titulo: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setAuthor(BRAND_NAME);
  pdf.setCreator(BRAND_NAME);
  pdf.setSubject("Archivo de impresión / Print file");
  pdf.setCreationDate(new Date());
  return { pdf };
}

/**
 * El archivo de impresión del mazo para una imprenta. `leeme` escribe la nota que va en el ZIP
 * cuando las caras y los reversos van en PDF separados.
 */
export async function generarArchivoImpresion(e: EntradaPdf, perfil: PerfilImprenta, leeme: (d: DatosLeeme) => string): Promise<ArchivoImpresion> {
  const estilo = obtenerEstilo(e.estiloId);
  const plantilla = obtenerPlantilla(estilo.plantilla);
  const paleta = obtenerPaleta(estilo, e.paletaId);
  const textos = textosCarta(e.idiomaMazo);
  // Sin las fuentes de las cartas no sale: con la de respaldo, el año y el día llegan a pisarse.
  await asegurarFuentesCartas(plantilla);

  const pxPorMm = PRINT.ppp / MM_POR_PULGADA;
  const { ancho: anchoPx, alto: altoPx } = medidasCara({ conSangrado: true, pxPorMm });
  const lienzo = crearLienzo(anchoPx, altoPx);
  const ctx = lienzo.ctx as CanvasRenderingContext2D;
  const opciones = { plantilla, estilo, paleta, tono: e.tono, idioma: e.idiomaMazo, textos, conSangrado: true, pxPorMm };
  const ajuste = ajusteSangrado({ anchoPx, altoPx, pxPorMm, disenoMm: PRINT.sangradoMm, imprentaMm: perfil.sangradoMm });
  const salida = ajuste.cambioPx === 0 ? lienzo : crearLienzo(ajuste.anchoPx, ajuste.altoPx);

  const titulo = e.titulo || BRAND_NAME;
  const base = baseArchivo(e.titulo, cartasImpresas(e.plan));
  const separadas = perfil.paginas === "separadas";
  const caras = await nuevoPdf(separadas ? `${titulo} · caras` : titulo);
  const reversos = separadas ? await nuevoPdf(`${titulo} · reversos`) : caras;
  const pagina = paginaImprenta(perfil);
  const total = e.plan.length * 2;
  let hechas = 0;

  for (const [indice, carta] of e.plan.entries()) {
    const foto = carta.foto ? await e.obtenerFoto(carta.foto.id) : null;
    try {
      for (const { cara, datos } of carta.caras) {
        const completos: DatosCarta = {
          ...datos,
          foto:
            foto && carta.foto
              ? { imagen: foto.imagen, escala: foto.ancho / carta.foto.anchoCopia, recorteAnverso: carta.foto.recorteAnverso, recorteReverso: carta.foto.recorteReverso }
              : null,
        };
        dibujarCara(ctx, cara, completos, opciones);
        // Fondo blanco por debajo de lo dibujado: el JPEG no admite transparencias.
        ctx.save();
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, anchoPx, altoPx);
        ctx.restore();
        if (salida !== lienzo) ajustarBorde(lienzo, salida, ajuste.cambioPx);

        const destino = cara === "anverso" ? caras : reversos;
        const imagen = await destino.pdf.embedJpg(await aJpeg(salida, perfil.maxBytesPagina));
        const p = destino.pdf.addPage([pt(pagina.ancho), pt(pagina.alto)]);
        const m = pagina.margen;
        const s = perfil.sangradoMm;
        p.drawImage(imagen, { x: pt(m), y: pt(m), width: pt(pagina.cara.ancho), height: pt(pagina.cara.alto) });
        p.setBleedBox(pt(m), pt(m), pt(pagina.cara.ancho), pt(pagina.cara.alto));
        p.setTrimBox(pt(m + s), pt(m + s), pt(PRINT.carta.anchoMm), pt(PRINT.carta.altoMm));
        if (perfil.marcasCorte) {
          await rotuloPagina(destino.pdf, p, m + s, `${indice + 1}/${e.plan.length} ${carta.clave.slice(0, 24)} ${cara === "anverso" ? "A" : "B"}`);
          marcasDeCorte(p, m + s, s);
        }
        hechas += 1;
        e.alProgresar?.(hechas, total);
        // Deja respirar a la interfaz para que se vea el progreso.
        await new Promise((ok) => setTimeout(ok, 0));
      }
    } finally {
      foto?.cerrar?.();
    }
  }

  const sufijo = `${PRINT.carta.anchoMm}x${PRINT.carta.altoMm}-${perfil.id}`;
  if (!separadas) return { nombre: `${base}-${sufijo}.pdf`, bytes: await caras.pdf.save(), tipo: "application/pdf" };
  const nombres = { caras: `${base}-caras.pdf`, reversos: `${base}-reversos.pdf` };
  const caja = e.plan.some((c) => c.tipo === "caja") ? "si" : "no";
  const nota = leeme({ titulo, cartas: cartasImpresas(e.plan), paginas: e.plan.length, caja, ...nombres });
  const zip = crearZip([
    { nombre: nombres.caras, bytes: await caras.pdf.save() },
    { nombre: nombres.reversos, bytes: await reversos.pdf.save() },
    { nombre: "LEEME.txt", bytes: new TextEncoder().encode(nota.replace(/\n/g, "\r\n")) },
  ]);
  return { nombre: `${base}-${sufijo}.zip`, bytes: zip, tipo: "application/zip" };
}

type Pagina = ReturnType<PDFDocument["addPage"]>;

/** Marcas de corte en las cuatro esquinas, fuera del sangrado. `borde` es la distancia del borde de la página al corte. */
function marcasDeCorte(p: Pagina, borde: number, sangrado: number) {
  const { largoMm, separacionMm, grosorPt } = PRINT.marcasCorte;
  const izq = borde;
  const der = borde + PRINT.carta.anchoMm;
  const abajo = borde;
  const arriba = borde + PRINT.carta.altoMm;
  const d = sangrado + separacionMm;
  const linea = (x1: number, y1: number, x2: number, y2: number) =>
    p.drawLine({ start: { x: pt(x1), y: pt(y1) }, end: { x: pt(x2), y: pt(y2) }, thickness: grosorPt, color: rgb(0, 0, 0) });
  for (const y of [abajo, arriba]) {
    linea(izq - d - largoMm, y, izq - d, y);
    linea(der + d, y, der + d + largoMm, y);
  }
  for (const x of [izq, der]) {
    linea(x, abajo - d - largoMm, x, abajo - d);
    linea(x, arriba + d, x, arriba + d + largoMm);
  }
}

/** Tamaño del rótulo de cada página, en puntos. */
const ROTULO_PT = 5;

/**
 * Qué cara es, en pequeño en el margen de las marcas: para que la imprenta no las confunda. Va como
 * imagen, gris sobre el blanco del papel: como texto, el PDF llevaría una fuente sin incrustar, y
 * las comprobaciones de las imprentas lo rechazan. La línea base queda a 1,6 mm del borde de abajo.
 */
async function rotuloPagina(pdf: PDFDocument, p: Pagina, borde: number, texto: string) {
  const px = Math.round((ROTULO_PT / 72) * PRINT.ppp);
  const letra = `${px}px Arial, Helvetica, sans-serif`;
  const medida = crearLienzo(1, 1);
  medida.ctx.font = letra;
  const anchoPx = Math.ceil(medida.ctx.measureText(texto).width) + 2;
  const altoPx = Math.ceil(px * 1.3);
  const base = Math.round(px * 1.05);
  const l = crearLienzo(anchoPx, altoPx);
  l.ctx.fillStyle = "#FFFFFF";
  l.ctx.fillRect(0, 0, anchoPx, altoPx);
  l.ctx.font = letra;
  l.ctx.fillStyle = "#595959";
  l.ctx.fillText(texto, 1, base);
  const imagen = await pdf.embedJpg(new Uint8Array(await (await l.aBlob("image/jpeg", 0.95)).arrayBuffer()));
  const mmPorPx = MM_POR_PULGADA / PRINT.ppp;
  p.drawImage(imagen, { x: pt(borde + 6), y: pt(1.6 - (altoPx - base) * mmPorPx), width: pt(anchoPx * mmPorPx), height: pt(altoPx * mmPorPx) });
}

/** Principio del nombre de los archivos, sin caracteres raros: «ana-y-leo-48-cartas». */
export function baseArchivo(titulo: string, cartas: number): string {
  const base =
    titulo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "mazo";
  return `${base}-${cartas}-cartas`;
}

/** Descarga unos bytes como archivo. */
export function descargar(bytes: Uint8Array, nombre: string, tipo = "application/pdf") {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
