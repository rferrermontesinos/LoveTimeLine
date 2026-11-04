/**
 * Archivo de impresión del mazo, generado en el navegador con el mismo dibujante que la vista previa.
 *
 * Cada cara es una página: la cara con sangrado rasterizada a 300 ppp (JPEG), un margen con
 * marcas de corte y las cajas TrimBox y BleedBox para la imprenta. Las caras van en pares
 * anverso-reverso, en el orden del plan (ver plan.ts).
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { BRAND_NAME } from "@config/brand";
import { MM_POR_PULGADA, PRINT, caraConSangradoMm } from "@config/print";
import { dibujarCara, medidasCara } from "@/lib/carta/dibujar";
import { cargarFuentesCartas } from "@/lib/carta/fuentes";
import { textosCarta } from "@/lib/carta/textos";
import type { DatosCarta } from "@/lib/carta/tipos";
import { obtenerEstilo, obtenerPlantilla, obtenerPaleta, type Tono } from "@/lib/estilos";
import { crearLienzo } from "@/lib/importar/lienzo";
import type { CartaPlan } from "./plan";

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
  /** Devuelve la foto a la mejor resolución disponible (la copia de trabajo). */
  obtenerFoto: (id: string) => Promise<FotoParaImprimir | null>;
  alProgresar?: (hechas: number, total: number) => void;
}

const PT_POR_MM = 72 / MM_POR_PULGADA;
const pt = (mm: number) => mm * PT_POR_MM;

/** Medidas de cada página del PDF, en milímetros. */
export function medidasPagina() {
  const cara = caraConSangradoMm();
  const margen = PRINT.marcasCorte.activas ? PRINT.marcasCorte.margenMm : 0;
  return { ancho: cara.ancho + 2 * margen, alto: cara.alto + 2 * margen, margen, cara };
}

export async function generarPdfMazo(e: EntradaPdf): Promise<Uint8Array> {
  const estilo = obtenerEstilo(e.estiloId);
  const plantilla = obtenerPlantilla(estilo.plantilla);
  const paleta = obtenerPaleta(estilo, e.paletaId);
  const textos = textosCarta(e.idiomaMazo);
  await cargarFuentesCartas(plantilla);

  const pxPorMm = PRINT.ppp / MM_POR_PULGADA;
  const { ancho: anchoPx, alto: altoPx } = medidasCara({ conSangrado: true, pxPorMm });
  const lienzo = crearLienzo(anchoPx, altoPx);
  const ctx = lienzo.ctx as CanvasRenderingContext2D;
  const opciones = { plantilla, estilo, paleta, tono: e.tono, idioma: e.idiomaMazo, textos, conSangrado: true, pxPorMm };

  const pdf = await PDFDocument.create();
  pdf.setTitle(e.titulo || BRAND_NAME);
  pdf.setAuthor(BRAND_NAME);
  pdf.setCreator(BRAND_NAME);
  pdf.setSubject("Archivo de impresión / Print file");
  pdf.setCreationDate(new Date());
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const pagina = medidasPagina();
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
        const jpeg = new Uint8Array(await (await lienzo.aBlob("image/jpeg", PRINT.calidadJpeg)).arrayBuffer());
        const imagen = await pdf.embedJpg(jpeg);

        const p = pdf.addPage([pt(pagina.ancho), pt(pagina.alto)]);
        const m = pagina.margen;
        const s = PRINT.sangradoMm;
        p.drawImage(imagen, { x: pt(m), y: pt(m), width: pt(pagina.cara.ancho), height: pt(pagina.cara.alto) });
        p.setBleedBox(pt(m), pt(m), pt(pagina.cara.ancho), pt(pagina.cara.alto));
        p.setTrimBox(pt(m + s), pt(m + s), pt(PRINT.carta.anchoMm), pt(PRINT.carta.altoMm));
        if (PRINT.marcasCorte.activas) {
          marcasDeCorte(p, m + s);
          p.drawText(`${indice + 1}/${e.plan.length} ${carta.clave.slice(0, 24)} ${cara === "anverso" ? "A" : "B"}`, {
            x: pt(m + s + 6),
            y: pt(1.6),
            size: 5,
            font: helvetica,
            color: rgb(0.35, 0.35, 0.35),
          });
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
  return pdf.save();
}

type Pagina = ReturnType<PDFDocument["addPage"]>;

/** Marcas de corte en las cuatro esquinas, fuera del sangrado. `borde` es la distancia del borde de la página al corte. */
function marcasDeCorte(p: Pagina, borde: number) {
  const { largoMm, separacionMm, grosorPt } = PRINT.marcasCorte;
  const izq = borde;
  const der = borde + PRINT.carta.anchoMm;
  const abajo = borde;
  const arriba = borde + PRINT.carta.altoMm;
  const d = PRINT.sangradoMm + separacionMm;
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

/** Nombre de archivo sin caracteres raros: «laura-y-marc-48-cartas.pdf». */
export function nombreArchivoPdf(titulo: string, cartas: number): string {
  const base =
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "mazo";
  return `${base}-${cartas}-cartas.pdf`;
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
